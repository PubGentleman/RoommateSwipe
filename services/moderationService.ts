import { supabase } from '../lib/supabase';

export async function reportUser(userId: string, reportedId: string, reason: string, details?: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: userId,
      reported_id: reportedId,
      reported_type: 'user',
      reason,
      details,
      severity: calculateSeverity(reason),
    })
    .select()
    .single();

  if (error) throw error;
  await runAutoModeration(reportedId, 'user', reason);
  return data;
}

export async function reportListing(userId: string, listingId: string, reason: string, details?: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: userId,
      reported_id: listingId,
      reported_type: 'listing',
      reason,
      details,
      severity: calculateSeverity(reason),
    })
    .select()
    .single();

  if (error) throw error;
  await runAutoModeration(listingId, 'listing', reason);
  return data;
}

export async function reportGroup(userId: string, groupId: string, reason: string, details?: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: userId,
      reported_id: groupId,
      reported_type: 'group',
      reason,
      details,
      severity: calculateSeverity(reason),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function submitDetailedReport(params: {
  reporterId: string;
  reportedId: string;
  reportedType: 'user' | 'listing' | 'group';
  reason: string;
  details?: string;
  evidenceUris?: string[];
}): Promise<{ success: boolean; reportId?: string; error?: string }> {
  let evidencePaths: string[] = [];
  if (params.evidenceUris && params.evidenceUris.length > 0) {
    for (const uri of params.evidenceUris) {
      const filename = `${params.reporterId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error } = await supabase.storage
          .from('report-evidence')
          .upload(filename, blob, { contentType: 'image/jpeg' });
        if (!error) evidencePaths.push(filename);
      } catch (err) {
        console.warn('[Moderation] Evidence upload failed:', err);
      }
    }
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: params.reporterId,
      reported_id: params.reportedId,
      reported_type: params.reportedType,
      reason: params.reason,
      details: params.details,
      evidence_paths: evidencePaths,
      severity: calculateSeverity(params.reason),
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  await runAutoModeration(params.reportedId, params.reportedType, params.reason);
  return { success: true, reportId: data.id };
}

function calculateSeverity(reason: string): 'low' | 'medium' | 'high' | 'critical' {
  const critical = ['scam_fraud', 'scam', 'underage', 'Scam or fraud'];
  const high = ['harassment', 'discriminatory', 'impersonation', 'fake_listing', 'Harassment', 'Fake or misleading listing'];
  const medium = ['fake_profile', 'fake_photos', 'stolen_photos', 'inappropriate', 'Fake profile', 'Inappropriate content'];

  if (critical.includes(reason)) return 'critical';
  if (high.includes(reason)) return 'high';
  if (medium.includes(reason)) return 'medium';
  return 'low';
}

async function runAutoModeration(
  reportedId: string,
  reportedType: string,
  reason: string
): Promise<void> {
  try {
    const { count: totalReports } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reported_id', reportedId)
      .eq('reported_type', reportedType)
      .in('status', ['pending', 'reviewed']);

    const reportCount = totalReports || 0;

    const { count: sameReasonCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reported_id', reportedId)
      .eq('reason', reason)
      .in('status', ['pending', 'reviewed']);

    if (reportedType === 'listing') {
      const shouldHide = reportCount >= 5 ||
        ((sameReasonCount || 0) >= 3 && ['scam_fraud', 'fake_listing'].includes(reason));

      if (shouldHide) {
        const { data: listing } = await supabase
          .from('listings')
          .select('host_id')
          .eq('id', reportedId)
          .single();

        await supabase
          .from('listings')
          .update({ is_active: false, auto_hidden: true, auto_hidden_reason: reason })
          .eq('id', reportedId);

        if (listing?.host_id) {
          await supabase.from('notifications').insert({
            user_id: listing.host_id,
            type: 'listing_hidden',
            title: 'Listing temporarily hidden',
            body: 'Your listing has been temporarily hidden due to multiple reports. Contact support to resolve.',
            metadata: { listingId: reportedId, reason },
          });
        }
      }
    }

    if (reportedType === 'user' && reportCount >= 10) {
      await supabase
        .from('users')
        .update({ account_restricted: true, restricted_reason: 'multiple_reports' })
        .eq('id', reportedId);
    }
  } catch (err) {
    console.warn('[Moderation] Auto-moderation check failed:', err);
  }
}

export async function getMyReports(
  userId: string
): Promise<Array<{
  id: string;
  reportedType: string;
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}>> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, reported_type, reason, status, created_at, resolved_at, resolution_note')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    reportedType: r.reported_type,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolution: r.resolution_note,
  }));
}

export interface ModerationReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedType: string;
  reason: string;
  details: string | null;
  severity: string;
  status: string;
  evidencePaths: string[];
  reportCount: number;
  createdAt: string;
}

export async function getModerationQueue(filters: {
  severity?: string;
  type?: string;
}): Promise<ModerationReportItem[]> {
  let query = supabase
    .from('reports')
    .select('*, reporter:users!reporter_id(full_name)')
    .in('status', ['pending', 'reviewed'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters.severity) query = query.eq('severity', filters.severity);
  if (filters.type) query = query.eq('reported_type', filters.type);

  const { data, error } = await query;
  if (error) throw error;

  const grouped = new Map<string, any>();
  for (const report of data || []) {
    const key = `${report.reported_id}_${report.reported_type}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...report,
        reportCount: 1,
      });
    } else {
      const existing = grouped.get(key);
      existing.reportCount += 1;
      if (severityOrder(report.severity) > severityOrder(existing.severity)) {
        existing.severity = report.severity;
      }
      if (new Date(report.created_at) > new Date(existing.created_at)) {
        existing.created_at = report.created_at;
      }
    }
  }

  return Array.from(grouped.values()).map(r => ({
    id: r.id,
    reporterId: r.reporter_id,
    reporterName: r.reporter?.full_name || 'Unknown',
    reportedId: r.reported_id,
    reportedType: r.reported_type,
    reason: r.reason,
    details: r.details,
    severity: r.severity,
    status: r.status,
    evidencePaths: r.evidence_paths || [],
    reportCount: r.reportCount,
    createdAt: r.created_at,
  })).sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));
}

function severityOrder(s: string): number {
  switch (s) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

export async function handleModerationAction(
  reportId: string,
  action: 'dismiss' | 'hide_listing' | 'restrict_user' | 'warn',
  moderatorId: string
): Promise<void> {
  const { data: report } = await supabase
    .from('reports')
    .select('reported_id, reported_type')
    .eq('id', reportId)
    .single();

  if (!report) throw new Error('Report not found');

  switch (action) {
    case 'dismiss':
      await supabase.from('reports').update({
        status: 'dismissed',
        resolved_at: new Date().toISOString(),
        resolution_note: 'Dismissed by moderator',
        moderator_id: moderatorId,
      }).eq('id', reportId);
      break;

    case 'hide_listing':
      await supabase
        .from('listings')
        .update({ is_active: false, auto_hidden: true, auto_hidden_reason: 'moderator_action' })
        .eq('id', report.reported_id);
      await supabase.from('reports').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_note: 'Listing hidden by moderator',
        moderator_id: moderatorId,
      }).eq('reported_id', report.reported_id).in('status', ['pending', 'reviewed']);
      break;

    case 'restrict_user':
      await supabase
        .from('users')
        .update({ account_restricted: true, restricted_reason: 'moderation_action' })
        .eq('id', report.reported_id);
      await supabase.from('reports').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_note: 'User restricted by moderator',
        moderator_id: moderatorId,
      }).eq('reported_id', report.reported_id).in('status', ['pending', 'reviewed']);
      break;

    case 'warn': {
      let targetUserId = report.reported_id;
      if (report.reported_type === 'listing') {
        const { data: listing } = await supabase
          .from('listings')
          .select('host_id')
          .eq('id', report.reported_id)
          .single();
        if (listing?.host_id) targetUserId = listing.host_id;
      }
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        type: 'moderation_warning',
        title: 'Content Warning',
        body: 'Your content has been flagged by the community. Please review our guidelines.',
      });
      await supabase.from('reports').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_note: 'Warning sent to user',
        moderator_id: moderatorId,
      }).eq('id', reportId);
      break;
    }
  }
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const { data } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);

  return (data || []).map(b => b.blocked_id);
}

export async function blockUser(userId: string, blockedId: string) {
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: userId, blocked_id: blockedId });

  if (error) throw error;
}

export async function unblockUser(userId: string, blockedId: string) {
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedId);

  if (error) throw error;
}

export async function getBlockedUsers(userId: string) {
  if (!userId) return [];

  const { data } = await supabase
    .from('blocked_users')
    .select('*, blocked:users!blocked_id(id, full_name, avatar_url)')
    .eq('blocker_id', userId);

  return data || [];
}

export async function isUserBlocked(userId: string, otherUserId: string): Promise<boolean> {
  if (!userId) return false;

  const { data } = await supabase
    .from('blocked_users')
    .select('id')
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`)
    .limit(1);

  return (data?.length || 0) > 0;
}
