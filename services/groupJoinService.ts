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
    for (const g of piGroups) {
      const accepted = (g.pi_auto_group_members || []).filter(
        (m: any) => m.status === 'accepted' || m.status === 'pending'
      );
      const spotsOpen = g.max_members - accepted.filter((m: any) => m.status === 'accepted').length;
      if (spotsOpen <= 0) continue;

      const memberIds = accepted.map((m: any) => m.user_id);
      const { data: memberUsers } = await supabase
        .from('users')
        .select('id, name, photos, age, occupation')
        .in('id', memberIds);

      results.push({
        id: g.id,
        groupType: 'pi_auto',
        members: (memberUsers || []).map((u: any) => ({
          user_id: u.id,
          name: u.name || 'Member',
          age: u.age,
          photo: u.photos?.[0],
          occupation: u.occupation,
        })),
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
    .eq('status', 'active');

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
