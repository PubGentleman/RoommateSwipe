import { supabase } from '../lib/supabase';
import { GroupJoinRequest, OpenGroupListing } from '../types/models';

const EXPIRY_HOURS = 48;

function expiresAt(): string {
  return new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
}

export async function getOpenGroups(
  userId: string,
  filters?: { city?: string; minCompatibility?: number; maxBudget?: number }
): Promise<OpenGroupListing[]> {
  const results: OpenGroupListing[] = [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('city, budget, apartment_search_type')
    .eq('user_id', userId)
    .single();

  const userCity = filters?.city || profile?.city;

  let piQuery = supabase
    .from('pi_auto_groups')
    .select('*, pi_auto_group_members(*)')
    .eq('open_to_requests', true)
    .in('status', ['partial', 'confirmed', 'pending_acceptance']);

  if (userCity) piQuery = piQuery.eq('city', userCity);

  const { data: piGroups } = await piQuery;

  if (piGroups) {
    const allMemberIds = new Set<string>();
    const groupAcceptedMap = new Map<string, any[]>();

    for (const g of piGroups) {
      const accepted = (g.pi_auto_group_members || []).filter(
        (m: any) => m.status === 'accepted' || m.status === 'pending'
      );
      groupAcceptedMap.set(g.id, accepted);
      accepted.forEach((m: any) => {
        if (m.user_id) allMemberIds.add(m.user_id);
      });
    }

    const { data: allUsers } = allMemberIds.size > 0
      ? await supabase
          .from('users')
          .select('id, name, photos, age, occupation')
          .in('id', Array.from(allMemberIds))
      : { data: [] };

    const userMap = new Map((allUsers || []).map((u: any) => [u.id, u]));

    for (const g of piGroups) {
      const accepted = groupAcceptedMap.get(g.id) || [];
      const spotsOpen = g.max_members - accepted.filter((m: any) => m.status === 'accepted').length;
      if (spotsOpen <= 0) continue;

      results.push({
        id: g.id,
        groupType: 'pi_auto',
        members: accepted.map((m: any) => {
          const u = userMap.get(m.user_id);
          return {
            user_id: m.user_id,
            name: u?.name || 'Member',
            age: u?.age,
            photo: u?.photos?.[0],
            occupation: u?.occupation,
          };
        }),
        spotsOpen,
        maxSize: g.max_members,
        city: g.city,
        neighborhoods: g.neighborhoods,
        budgetMin: g.budget_min,
        budgetMax: g.budget_max,
        desiredBedrooms: g.desired_bedrooms,
        createdAt: g.created_at,
      });
    }
  }

  let preQuery = supabase
    .from('preformed_groups')
    .select('*, preformed_group_members(*)')
    .eq('open_to_requests', true)
    .in('status', ['active', 'forming', 'ready', 'searching']);

  if (userCity) preQuery = preQuery.eq('city', userCity);

  const { data: preGroups } = await preQuery;

  if (preGroups) {
    for (const g of preGroups) {
      const joined = (g.preformed_group_members || []).filter(
        (m: any) => m.status === 'joined'
      );
      const spotsOpen = g.group_size - joined.length;
      if (spotsOpen <= 0) continue;

      results.push({
        id: g.id,
        groupType: 'preformed',
        groupName: g.name,
        members: joined.map((m: any) => ({
          user_id: m.user_id,
          name: m.name || 'Member',
        })),
        spotsOpen,
        maxSize: g.group_size,
        city: g.city,
        budgetMin: g.budget_min,
        budgetMax: g.budget_max,
        desiredBedrooms: g.bedroom_count,
        createdAt: g.created_at,
        needsReplacement: g.needs_replacement ?? false,
      });
    }
  }

  // 3. Discoverable agent-assembled groups
  let agentQuery = supabase
    .from('groups')
    .select(`
      id,
      name,
      city,
      max_members,
      budget_min,
      budget_max,
      move_in_date,
      created_by_agent,
      target_listing_id,
      group_status,
      created_at,
      group_members(
        user_id,
        role,
        user:users!user_id(id, full_name, avatar_url, age, occupation)
      )
    `)
    .eq('agent_assembled', true)
    .eq('is_discoverable', true)
    .in('group_status', ['assembling', 'active']);

  if (userCity) agentQuery = agentQuery.eq('city', userCity);

  const { data: agentGroups } = await agentQuery;

  if (agentGroups) {
    for (const g of agentGroups) {
      const members = g.group_members || [];
      const spotsOpen = (g.max_members || 4) - members.length;
      if (spotsOpen <= 0) continue;

      const memberIds = members.map((m: any) => m.user_id);
      if (memberIds.includes(userId)) continue;

      results.push({
        id: g.id,
        groupType: 'agent',
        groupName: g.name,
        members: members.map((m: any) => ({
          user_id: m.user_id,
          name: m.user?.full_name || 'Member',
          age: m.user?.age,
          photo: m.user?.avatar_url,
          occupation: m.user?.occupation,
        })),
        spotsOpen,
        maxSize: g.max_members || 4,
        city: g.city,
        budgetMin: g.budget_min,
        budgetMax: g.budget_max,
        createdAt: g.created_at,
        agentId: g.created_by_agent,
      });
    }
  }

  if (filters?.maxBudget) {
    return results.filter(
      g => !g.budgetMax || g.budgetMax <= filters.maxBudget!
    );
  }

  return results;
}

export async function requestToJoin(
  userId: string,
  groupId: string,
  groupType: 'pi_auto' | 'preformed',
  message?: string
): Promise<GroupJoinRequest | null> {
  const { data: existing } = await supabase
    .from('group_join_requests')
    .select('id')
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error('You already have a pending request. Withdraw it first.');
  }

  const insert: Record<string, unknown> = {
    requester_id: userId,
    status: 'pending',
    expires_at: expiresAt(),
    requester_message: message?.trim() || null,
  };

  if (groupType === 'pi_auto') {
    insert.pi_auto_group_id = groupId;
  } else {
    insert.preformed_group_id = groupId;
  }

  const { data, error } = await supabase
    .from('group_join_requests')
    .insert(insert)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function withdrawRequest(
  userId: string,
  requestId: string
): Promise<void> {
  const { error } = await supabase
    .from('group_join_requests')
    .update({ status: 'withdrawn', decided_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('requester_id', userId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

export async function getMyRequests(userId: string): Promise<GroupJoinRequest[]> {
  const { data } = await supabase
    .from('group_join_requests')
    .select('*')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });

  return (data || []) as GroupJoinRequest[];
}

export async function getGroupRequests(
  groupId: string,
  groupType: 'pi_auto' | 'preformed'
): Promise<GroupJoinRequest[]> {
  const column = groupType === 'pi_auto' ? 'pi_auto_group_id' : 'preformed_group_id';

  const { data } = await supabase
    .from('group_join_requests')
    .select('*')
    .eq(column, groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return [];

  const requesterIds = data.map(r => r.requester_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, name, photos, age, occupation, bio')
    .in('id', requesterIds);

  const userMap = new Map((users || []).map(u => [u.id, u]));

  return data.map(r => ({
    ...r,
    requester: userMap.get(r.requester_id) || undefined,
  })) as GroupJoinRequest[];
}

export async function voteOnRequest(
  voterId: string,
  requestId: string,
  vote: 'approve' | 'decline'
): Promise<{ result: 'voted' | 'approved' | 'declined' }> {
  const { data: request, error } = await supabase
    .from('group_join_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single();

  if (error || !request) throw new Error('Request not found or already decided');
  if (!request.pi_auto_group_id) throw new Error('Not a Pi auto-group request');

  const { data: members } = await supabase
    .from('pi_auto_group_members')
    .select('user_id')
    .eq('group_id', request.pi_auto_group_id)
    .eq('status', 'accepted');

  const voterIds = (members || []).map((m: { user_id: string }) => m.user_id);
  if (!voterIds.includes(voterId)) {
    throw new Error('Only group members can vote on requests');
  }

  const alreadyApproved = (request.approved_by || []).includes(voterId);
  const alreadyDeclined = (request.declined_by || []).includes(voterId);
  if (alreadyApproved || alreadyDeclined) {
    throw new Error('You have already voted on this request');
  }

  const majorityThreshold = Math.ceil(voterIds.length / 2);

  if (vote === 'approve') {
    const approvals: string[] = [...(request.approved_by || []), voterId];
    const { error: updateErr } = await supabase
      .from('group_join_requests')
      .update({ approved_by: approvals })
      .eq('id', requestId);

    if (updateErr) throw new Error(updateErr.message);

    if (approvals.length >= majorityThreshold) {
      await finalizeApproval(request);
      return { result: 'approved' };
    }
    return { result: 'voted' };
  } else {
    const declines: string[] = [...(request.declined_by || []), voterId];
    const { error: updateErr } = await supabase
      .from('group_join_requests')
      .update({ declined_by: declines })
      .eq('id', requestId);

    if (updateErr) throw new Error(updateErr.message);

    if (declines.length >= majorityThreshold) {
      const { error: declineErr } = await supabase
        .from('group_join_requests')
        .update({ status: 'declined', decided_at: new Date().toISOString() })
        .eq('id', requestId);
      if (declineErr) throw new Error(declineErr.message);
      return { result: 'declined' };
    }
    return { result: 'voted' };
  }
}

export async function decideOnRequest(
  leadId: string,
  requestId: string,
  decision: 'approve' | 'decline'
): Promise<void> {
  const { data: request, error } = await supabase
    .from('group_join_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single();

  if (error || !request) throw new Error('Request not found or already decided');
  if (!request.preformed_group_id) throw new Error('Not a preformed group request');

  const { data: group } = await supabase
    .from('preformed_groups')
    .select('group_lead_id')
    .eq('id', request.preformed_group_id)
    .single();

  if (group?.group_lead_id !== leadId) {
    throw new Error('Only the Group Lead can decide on requests');
  }

  if (decision === 'approve') {
    await finalizePreformedApproval(request);
    await supabase
      .from('group_join_requests')
      .update({
        status: 'approved',
        decided_by: leadId,
        decided_at: new Date().toISOString(),
      })
      .eq('id', requestId);
  } else {
    await supabase
      .from('group_join_requests')
      .update({
        status: 'declined',
        decided_by: leadId,
        decided_at: new Date().toISOString(),
      })
      .eq('id', requestId);
  }
}

async function finalizeApproval(request: GroupJoinRequest): Promise<void> {
  const { error: insertErr } = await supabase.from('pi_auto_group_members').insert({
    group_id: request.pi_auto_group_id,
    user_id: request.requester_id,
    role: 'member',
    status: 'accepted',
    invited_at: new Date().toISOString(),
    responded_at: new Date().toISOString(),
  });

  if (insertErr) throw new Error(`Failed to add member: ${insertErr.message}`);

  await supabase
    .from('group_join_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', request.id);

  const { data: group } = await supabase
    .from('pi_auto_groups')
    .select('*, pi_auto_group_members(*)')
    .eq('id', request.pi_auto_group_id)
    .single();

  if (group) {
    const accepted = (group.pi_auto_group_members || []).filter(
      (m: any) => m.status === 'accepted'
    );
    if (accepted.length >= group.max_members) {
      await supabase
        .from('pi_auto_groups')
        .update({ open_to_requests: false })
        .eq('id', group.id);

      await supabase
        .from('group_join_requests')
        .update({ status: 'declined', decided_at: new Date().toISOString() })
        .eq('pi_auto_group_id', group.id)
        .eq('status', 'pending')
        .neq('id', request.id);
    }
  }
}

async function finalizePreformedApproval(request: GroupJoinRequest): Promise<void> {
  const { data: requester } = await supabase
    .from('users')
    .select('name')
    .eq('id', request.requester_id)
    .single();

  await supabase.from('preformed_group_members').insert({
    preformed_group_id: request.preformed_group_id,
    user_id: request.requester_id,
    name: requester?.name || 'Member',
    role: 'member',
    status: 'joined',
  });

  const { data: group } = await supabase
    .from('preformed_groups')
    .select('*, preformed_group_members(*)')
    .eq('id', request.preformed_group_id)
    .single();

  if (group) {
    const joined = (group.preformed_group_members || []).filter(
      (m: any) => m.status === 'joined'
    );
    if (joined.length >= group.group_size) {
      await supabase
        .from('preformed_groups')
        .update({ open_to_requests: false })
        .eq('id', group.id);

      await supabase
        .from('group_join_requests')
        .update({ status: 'declined', decided_at: new Date().toISOString() })
        .eq('preformed_group_id', group.id)
        .eq('status', 'pending')
        .neq('id', request.id);
    }
  }
}

export async function toggleOpenToRequests(
  groupId: string,
  groupType: 'pi_auto' | 'preformed',
  open: boolean
): Promise<void> {
  const table = groupType === 'pi_auto' ? 'pi_auto_groups' : 'preformed_groups';
  await supabase.from(table).update({ open_to_requests: open }).eq('id', groupId);
}

export async function requestToJoinAgentGroup(
  userId: string,
  groupId: string,
  message?: string
): Promise<GroupJoinRequest | null> {
  const { data: existing } = await supabase
    .from('group_join_requests')
    .select('id, status')
    .eq('agent_group_id', groupId)
    .eq('requester_id', userId)
    .in('status', ['pending'])
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error('You already have a pending request for this group.');
  }

  const { data, error } = await supabase
    .from('group_join_requests')
    .insert({
      agent_group_id: groupId,
      requester_id: userId,
      status: 'pending',
      expires_at: expiresAt(),
      requester_message: message?.trim() || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getAgentGroupJoinRequests(
  agentId: string,
  groupIds: string[]
): Promise<Record<string, GroupJoinRequest[]>> {
  if (groupIds.length === 0) return {};

  const { data } = await supabase
    .from('group_join_requests')
    .select('*')
    .in('agent_group_id', groupIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return {};

  const requesterIds = [...new Set(data.map(r => r.requester_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, age, gender')
    .in('id', requesterIds);

  const userMap = new Map((users || []).map(u => [u.id, u]));

  const byGroup: Record<string, GroupJoinRequest[]> = {};
  for (const req of data) {
    const gid = req.agent_group_id;
    if (!gid) continue;
    if (!byGroup[gid]) byGroup[gid] = [];
    byGroup[gid].push({
      ...req,
      requester: userMap.get(req.requester_id) as any,
    });
  }
  return byGroup;
}

export async function approveAgentGroupRequest(
  agentId: string,
  requestId: string,
  groupId: string,
  userId: string
): Promise<void> {
  await supabase
    .from('group_join_requests')
    .update({
      status: 'approved',
      decided_by: agentId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      role: 'member',
      joined_at: new Date().toISOString(),
    });

  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  const { data: groupData } = await supabase
    .from('groups')
    .select('max_members')
    .eq('id', groupId)
    .single();

  if ((count ?? 0) >= (groupData?.max_members || 4)) {
    await supabase
      .from('groups')
      .update({ is_discoverable: false })
      .eq('id', groupId);

    await supabase
      .from('group_join_requests')
      .update({ status: 'declined', decided_at: new Date().toISOString() })
      .eq('agent_group_id', groupId)
      .eq('status', 'pending')
      .neq('id', requestId);
  }
}

export async function declineAgentGroupRequest(
  agentId: string,
  requestId: string
): Promise<void> {
  await supabase
    .from('group_join_requests')
    .update({
      status: 'declined',
      decided_by: agentId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId);
}

export async function getMyAgentGroupRequests(
  userId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('group_join_requests')
    .select('agent_group_id, status')
    .eq('requester_id', userId)
    .not('agent_group_id', 'is', null);

  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => {
    if (r.agent_group_id) map[r.agent_group_id] = r.status;
  });
  return map;
}
