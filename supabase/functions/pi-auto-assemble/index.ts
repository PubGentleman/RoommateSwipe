import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  serializeFullContext, CORS_HEADERS, errorResponse, jsonResponse,
  PI_AUTO_ASSEMBLE_PERSONA, stripName,
} from '../_shared/pi-utils.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

const MIN_PAIRWISE_SCORE = 51;
const ELIGIBLE_ACTIVE_DAYS = 30;

function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`) return true;
  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) return true;
  return false;
}

interface CandidateProfile {
  user_id: string;
  full_name: string;
  age: number;
  gender: string;
  city: string;
  budget: number;
  desired_roommate_count: number;
  household_gender_preference: string;
  move_in_date: string | null;
  userData: Record<string, any>;
  profileData: Record<string, any>;
}

function calculatePairwiseScore(a: CandidateProfile, b: CandidateProfile): number {
  let score = 0;
  const maxScore = 100;

  if (a.budget && b.budget) {
    const diff = Math.abs(a.budget - b.budget) / Math.max(a.budget, b.budget);
    if (diff <= 0.1) score += 20;
    else if (diff <= 0.25) score += 14;
    else if (diff <= 0.5) score += 6;
  } else {
    score += 10;
  }

  if (a.age && b.age) {
    const ageDiff = Math.abs(a.age - b.age);
    if (ageDiff <= 2) score += 15;
    else if (ageDiff <= 5) score += 10;
    else if (ageDiff <= 10) score += 5;
  } else {
    score += 7;
  }

  const aN = new Set((a.profileData?.preferred_neighborhoods || []).map((n: string) => n.toLowerCase()));
  const bN = new Set((b.profileData?.preferred_neighborhoods || []).map((n: string) => n.toLowerCase()));
  let overlap = 0;
  for (const n of aN) { if (bN.has(n)) overlap++; }
  if (overlap >= 2) score += 20;
  else if (overlap === 1) score += 14;
  else if (a.city === b.city) score += 8;

  const aSleep = a.profileData?.preferences?.sleepSchedule;
  const bSleep = b.profileData?.preferences?.sleepSchedule;
  if (aSleep && bSleep) {
    if (aSleep === bSleep) score += 15;
    else if (aSleep === 'flexible' || bSleep === 'flexible') score += 10;
    else score += 2;
  } else {
    score += 7;
  }

  const aClean = a.profileData?.preferences?.cleanliness;
  const bClean = b.profileData?.preferences?.cleanliness;
  if (aClean && bClean) {
    if (aClean === bClean) score += 15;
    else score += 5;
  } else {
    score += 7;
  }

  const aSmoke = a.profileData?.preferences?.smoking;
  const bSmoke = b.profileData?.preferences?.smoking;
  if (aSmoke === 'no' && bSmoke === 'no') score += 10;
  else if (aSmoke === bSmoke) score += 8;
  else if (!aSmoke || !bSmoke) score += 5;
  else score += 0;

  if (a.move_in_date && b.move_in_date) {
    const aDate = new Date(a.move_in_date);
    const bDate = new Date(b.move_in_date);
    const daysDiff = Math.abs(aDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 14) score += 5;
    else if (daysDiff <= 30) score += 3;
    else score += 0;
  } else {
    score += 2;
  }

  return Math.min(Math.round((score / maxScore) * 100), 100);
}

function checkGenderCompatibility(members: CandidateProfile[]): boolean {
  for (const m of members) {
    const pref = m.household_gender_preference;
    if (!pref || pref === 'any') continue;
    for (const o of members) {
      if (o.user_id === m.user_id) continue;
      if (pref === 'male_only' && o.gender !== 'male') return false;
      if (pref === 'female_only' && o.gender !== 'female') return false;
      if (pref === 'same_gender' && o.gender !== m.gender) return false;
    }
  }
  return true;
}

function getGenderPoolKey(pref: string, gender: string): string {
  if (!pref || pref === 'any') return 'any';
  if (pref === 'male_only') return 'male_only';
  if (pref === 'female_only') return 'female_only';
  if (pref === 'same_gender') return `same_${gender}`;
  return 'any';
}

function checkBudgetAlignment(members: CandidateProfile[]): boolean {
  const budgets = members.map(m => m.budget).filter(b => b > 0);
  if (budgets.length < 2) return true;
  const max = Math.max(...budgets);
  const min = Math.min(...budgets);
  return (max - min) / max <= 0.35;
}

function checkMoveInAlignment(members: CandidateProfile[]): boolean {
  const dates = members
    .map(m => m.move_in_date ? new Date(m.move_in_date).getTime() : null)
    .filter((d): d is number => d !== null && !isNaN(d));
  if (dates.length < 2) return true;
  const daysDiff = Math.round((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24));
  return daysDiff <= 30;
}

function calculateNeighborhoodBonus(members: CandidateProfile[]): number {
  const sets = members.map(m => {
    const hoods = (m.profileData?.preferred_neighborhoods || []).map((n: string) => n.toLowerCase());
    return new Set<string>(hoods);
  });
  if (sets.some(s => s.size === 0)) return 0;
  let common = 0;
  for (const hood of sets[0]) {
    if (sets.every(s => s.has(hood))) common++;
  }
  return common >= 2 ? 10 : common === 1 ? 5 : 0;
}

function greedyAssemble(
  pool: CandidateProfile[],
  targetSize: number,
  globalReserved: Set<string>
): CandidateProfile[][] {
  const groups: CandidateProfile[][] = [];
  const localUsed = new Set<string>();

  const candidates = pool.filter(c => !globalReserved.has(c.user_id));

  while (candidates.filter(c => !localUsed.has(c.user_id)).length >= targetSize) {
    const available = candidates.filter(c => !localUsed.has(c.user_id));

    let bestPair: [CandidateProfile, CandidateProfile] | null = null;
    let bestPairScore = -1;

    for (let i = 0; i < Math.min(available.length, 50); i++) {
      for (let j = i + 1; j < Math.min(available.length, 50); j++) {
        const score = calculatePairwiseScore(available[i], available[j]);
        if (score >= MIN_PAIRWISE_SCORE && score > bestPairScore &&
            checkGenderCompatibility([available[i], available[j]]) &&
            checkBudgetAlignment([available[i], available[j]]) &&
            checkMoveInAlignment([available[i], available[j]])) {
          bestPairScore = score;
          bestPair = [available[i], available[j]];
        }
      }
    }

    if (!bestPair || bestPairScore < MIN_PAIRWISE_SCORE) break;

    const group = [...bestPair];
    localUsed.add(bestPair[0].user_id);
    localUsed.add(bestPair[1].user_id);

    while (group.length < targetSize) {
      const remaining = available.filter(c => !localUsed.has(c.user_id));
      if (remaining.length === 0) break;

      let bestCandidate: CandidateProfile | null = null;
      let bestAvgScore = -1;

      for (const candidate of remaining.slice(0, 30)) {
        const scores = group.map(m => calculatePairwiseScore(m, candidate));
        const minScore = Math.min(...scores);
        if (minScore < MIN_PAIRWISE_SCORE) continue;

        const testGroup = [...group, candidate];
        if (!checkGenderCompatibility(testGroup)) continue;
        if (!checkBudgetAlignment(testGroup)) continue;
        if (!checkMoveInAlignment(testGroup)) continue;

        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        const hoodBonus = calculateNeighborhoodBonus(testGroup);
        const adjustedAvg = avg + hoodBonus;
        if (adjustedAvg > bestAvgScore) {
          bestAvgScore = adjustedAvg;
          bestCandidate = candidate;
        }
      }

      if (!bestCandidate) break;
      group.push(bestCandidate);
      localUsed.add(bestCandidate.user_id);
    }

    if (group.length >= 2) {
      for (const m of group) globalReserved.add(m.user_id);
      groups.push(group);
    }
  }

  return groups;
}

function findReplacements(
  pool: CandidateProfile[],
  existingMembers: CandidateProfile[],
  spotsNeeded: number,
  globalReserved: Set<string>
): CandidateProfile[] {
  const candidates = pool.filter(c => !globalReserved.has(c.user_id));
  const replacements: CandidateProfile[] = [];

  for (const candidate of candidates) {
    if (replacements.length >= spotsNeeded) break;

    const scores = existingMembers.map(m => calculatePairwiseScore(m, candidate));
    const minScore = Math.min(...scores);
    if (minScore < MIN_PAIRWISE_SCORE) continue;

    const testGroup = [...existingMembers, ...replacements, candidate];
    if (!checkGenderCompatibility(testGroup)) continue;

    replacements.push(candidate);
    globalReserved.add(candidate.user_id);
  }

  return replacements;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (!verifyCronAuth(req)) {
    return errorResponse('Unauthorized: service-role or cron secret required', 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const filterCity: string | undefined = body.city;
    const filterUserId: string | undefined = body.user_id;
    const dryRun: boolean = body.dry_run ?? false;
    const replacementForGroup: string | undefined = body.replacement_for_group;
    const spotsNeeded: number = body.spots_needed ?? 0;
    const excludeUsers: string[] = body.exclude_users ?? [];

    const cutoffDate = new Date(Date.now() - ELIGIBLE_ACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let profileQuery = supabase
      .from('profiles')
      .select('*')
      .eq('pi_auto_match_enabled', true)
      .gte('last_active_at', cutoffDate)
      .not('city', 'is', null)
      .not('budget', 'is', null);

    if (filterCity) profileQuery = profileQuery.eq('city', filterCity);
    if (filterUserId) profileQuery = profileQuery.eq('user_id', filterUserId);

    const { data: rawProfiles, error: profileError } = await profileQuery;
    if (profileError) return errorResponse(`Profile query failed: ${profileError.message}`, 500);
    if (!rawProfiles || rawProfiles.length === 0) return jsonResponse({ groups_created: 0, message: 'No eligible renters found' });

    const profiles = rawProfiles.filter((p: any) => {
      const searchType = p.apartment_search_type;
      if (searchType === 'solo' || searchType === 'with_partner' || searchType === 'have_group') return false;
      return true;
    });
    if (profiles.length === 0) return jsonResponse({ groups_created: 0, message: 'No eligible renters after intent filter' });

    const profileUserIds = profiles.map((p: any) => p.user_id);

    const { data: existingMembers } = await supabase
      .from('pi_auto_group_members')
      .select('user_id')
      .in('user_id', profileUserIds)
      .in('status', ['pending', 'accepted']);

    const inGroupSet = new Set((existingMembers || []).map((m: any) => m.user_id));

    const { data: users } = await supabase
      .from('users')
      .select('*')
      .in('id', profileUserIds)
      .eq('role', 'renter');

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const { data: photoCheck } = await supabase
      .from('users')
      .select('id, photos')
      .in('id', profileUserIds);

    const hasPhotoSet = new Set(
      (photoCheck || [])
        .filter((u: any) => u.photos && Array.isArray(u.photos) && u.photos.length > 0)
        .map((u: any) => u.id)
    );

    const excludeSet = new Set(excludeUsers);

    const eligible: CandidateProfile[] = profiles
      .filter((p: any) =>
        !inGroupSet.has(p.user_id) &&
        !excludeSet.has(p.user_id) &&
        userMap.has(p.user_id) &&
        hasPhotoSet.has(p.user_id)
      )
      .map((p: any) => {
        const u = userMap.get(p.user_id)!;
        return {
          user_id: p.user_id,
          full_name: u.full_name || u.name || 'User',
          age: u.age || p.age,
          gender: p.gender || u.gender || 'other',
          city: p.city || '',
          budget: p.budget || 0,
          desired_roommate_count: p.desired_roommate_count ?? 0,
          household_gender_preference: p.household_gender_preference || 'any',
          move_in_date: p.preferences?.moveInDate || p.move_in_date || null,
          userData: u,
          profileData: p,
        };
      });

    if (eligible.length < 1) {
      return jsonResponse({ groups_created: 0, message: 'Not enough eligible renters' });
    }

    if (replacementForGroup && spotsNeeded > 0) {
      return await handleReplacementFlow(supabase, eligible, replacementForGroup, spotsNeeded, dryRun);
    }

    if (eligible.length < 2) {
      return jsonResponse({ groups_created: 0, message: 'Not enough eligible renters' });
    }

    const cityPools = new Map<string, CandidateProfile[]>();
    for (const c of eligible) {
      const city = c.city.toLowerCase();
      if (!cityPools.has(city)) cityPools.set(city, []);
      cityPools.get(city)!.push(c);
    }

    const globalReserved = new Set<string>();
    const allCandidateGroups: CandidateProfile[][] = [];

    for (const [, pool] of cityPools) {
      if (pool.length < 2) continue;

      const genderPrefPools = new Map<string, CandidateProfile[]>();
      for (const c of pool) {
        const key = getGenderPoolKey(c.household_gender_preference, c.gender);
        if (!genderPrefPools.has(key)) genderPrefPools.set(key, []);
        genderPrefPools.get(key)!.push(c);
      }

      const anyPool = genderPrefPools.get('any') || [];

      for (const [genderKey, genderPool] of genderPrefPools) {
        if (genderKey === 'any') continue;

        const combinedPool = [...genderPool, ...anyPool.filter(c => !genderPool.includes(c))];

        const sizePools = new Map<number, CandidateProfile[]>();
        for (const c of combinedPool) {
          const target = c.desired_roommate_count > 0 ? c.desired_roommate_count + 1 : 2;
          if (!sizePools.has(target)) sizePools.set(target, []);
          sizePools.get(target)!.push(c);
        }

        const noPreference = combinedPool.filter(c => c.desired_roommate_count === 0);

        for (const [size, sizePool] of sizePools) {
          const combined = [...sizePool, ...noPreference.filter(c => !sizePool.includes(c))];
          if (combined.length < size) continue;
          const assembled = greedyAssemble(combined, Math.min(size, 5), globalReserved);
          allCandidateGroups.push(...assembled);
        }
      }

      if (anyPool.length >= 2) {
        const remainingAny = anyPool.filter(c => !globalReserved.has(c.user_id));
        if (remainingAny.length >= 2) {
          const sizePools = new Map<number, CandidateProfile[]>();
          for (const c of remainingAny) {
            const target = c.desired_roommate_count > 0 ? c.desired_roommate_count + 1 : 2;
            if (!sizePools.has(target)) sizePools.set(target, []);
            sizePools.get(target)!.push(c);
          }

          const noPreference = remainingAny.filter(c => c.desired_roommate_count === 0);

          for (const [size, sizePool] of sizePools) {
            const combined = [...sizePool, ...noPreference.filter(c => !sizePool.includes(c))];
            if (combined.length < size) continue;
            const assembled = greedyAssemble(combined, Math.min(size, 5), globalReserved);
            allCandidateGroups.push(...assembled);
          }
        }
      }
    }

    if (allCandidateGroups.length === 0) {
      return jsonResponse({ groups_created: 0, message: 'No viable groups assembled' });
    }

    let groupsCreated = 0;
    const results: any[] = [];

    for (const group of allCandidateGroups.slice(0, 10)) {
      const memberContexts = group.map(m =>
        serializeFullContext(m.userData, m.profileData, `MEMBER: ${stripName(m.full_name)} (${m.age}yo)`)
      ).join('\n\n');

      const scores = [];
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          scores.push({
            pair: `${stripName(group[i].full_name)} & ${stripName(group[j].full_name)}`,
            score: calculatePairwiseScore(group[i], group[j]),
          });
        }
      }
      const avgScore = Math.round(scores.reduce((s, v) => s + v.score, 0) / scores.length);
      const minScore = Math.min(...scores.map(s => s.score));

      const prompt = `${memberContexts}

PAIRWISE SCORES:
${scores.map(s => `- ${s.pair}: ${s.score}%`).join('\n')}
Average: ${avgScore}% | Minimum: ${minScore}%

Validate this candidate roommate group. Consider:
1. Would these people actually enjoy living together?
2. Are there any personality clashes the algorithm might have missed?
3. Does the lifestyle rhythm work (sleep, work, socializing)?
4. Any red flags or concerns?

Respond with ONLY this JSON:
{
  "approved": true/false,
  "confidence": 0.0-1.0,
  "summary": "2-3 sentences in Pi's voice explaining why this group works (or doesn't)",
  "member_insights": [
    {"user_id": "id", "role_in_group": "e.g. the social connector, the stabilizer, etc.", "note": "one-sentence insight"}
  ],
  "risks": ["0-3 specific risks or concerns"]
}`;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            system: PI_AUTO_ASSEMBLE_PERSONA,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!response.ok) {
          console.error('Claude API error:', response.status);
          continue;
        }

        const claudeData = await response.json();
        const rawText = claudeData.content?.[0]?.text ?? '';
        let result: any = null;
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) result = JSON.parse(jsonMatch[0]);
        } catch {}

        if (!result) continue;

        results.push({
          members: group.map(m => ({ user_id: m.user_id, name: stripName(m.full_name) })),
          avgScore,
          minScore,
          validation: result,
        });

        if (!result.approved) continue;
        if (dryRun) { groupsCreated++; continue; }

        const anchorUser = group[0];

        const { data: newGroup, error: groupError } = await supabase
          .from('pi_auto_groups')
          .insert({
            anchor_user_id: anchorUser.user_id,
            city: anchorUser.city,
            max_members: group.length,
            status: 'forming',
            pi_summary: result.summary,
            pi_confidence: result.confidence,
            pi_risks: result.risks || [],
            avg_compatibility_score: avgScore,
          })
          .select('id')
          .single();

        if (groupError || !newGroup) {
          console.error('Group insert error:', groupError);
          continue;
        }

        const memberInserts = group.map((m, idx) => ({
          group_id: newGroup.id,
          user_id: m.user_id,
          status: 'pending',
          invited_at: new Date().toISOString(),
          role_in_group: result.member_insights?.[idx]?.role_in_group || null,
        }));

        const { error: memberError } = await supabase
          .from('pi_auto_group_members')
          .insert(memberInserts);

        if (memberError) {
          console.error('Member insert error:', memberError);
          await supabase.from('pi_auto_groups').delete().eq('id', newGroup.id);
          continue;
        }

        groupsCreated++;

        await supabase.from('pi_usage_log').insert({
          user_id: anchorUser.user_id,
          feature: 'auto_assemble',
          tokens_used: (claudeData.usage?.input_tokens ?? 0) + (claudeData.usage?.output_tokens ?? 0),
          model_used: 'claude-sonnet-4-5',
        });
      } catch (err) {
        console.error('Group validation error:', err);
        continue;
      }
    }

    return jsonResponse({
      groups_created: groupsCreated,
      candidates_evaluated: allCandidateGroups.length,
      eligible_renters: eligible.length,
      results: dryRun ? results : undefined,
    });
  } catch (err: any) {
    console.error('pi-auto-assemble error:', err);
    return errorResponse('Auto-assemble pipeline failed', 500);
  }
});

async function handleReplacementFlow(
  supabase: any,
  eligible: CandidateProfile[],
  groupId: string,
  spotsNeeded: number,
  dryRun: boolean
): Promise<Response> {
  const { data: group, error: groupError } = await supabase
    .from('pi_auto_groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (groupError || !group) return errorResponse('Group not found for replacement', 404);

  const { data: currentMembers } = await supabase
    .from('pi_auto_group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'accepted');

  if (!currentMembers || currentMembers.length === 0) {
    return errorResponse('No accepted members in group', 400);
  }

  const currentUserIds = currentMembers.map((m: any) => m.user_id);
  const { data: currentUsers } = await supabase
    .from('users')
    .select('*')
    .in('id', currentUserIds);

  const currentUserMap = new Map((currentUsers || []).map((u: any) => [u.id, u]));

  const existingProfiles: CandidateProfile[] = currentMembers.map((m: any) => {
    const u = currentUserMap.get(m.user_id) || {};
    return {
      user_id: m.user_id,
      full_name: u.full_name || u.name || 'User',
      age: u.age || 0,
      gender: u.gender || 'other',
      city: group.city || '',
      budget: u.budget || 0,
      desired_roommate_count: 0,
      household_gender_preference: u.household_gender_preference || 'any',
      move_in_date: null,
      userData: u,
      profileData: {},
    };
  });

  const globalReserved = new Set<string>(currentUserIds);
  const replacements = findReplacements(eligible, existingProfiles, spotsNeeded, globalReserved);

  if (replacements.length === 0) {
    return jsonResponse({
      replacements_found: 0,
      message: 'No compatible replacements found',
      group_id: groupId,
    });
  }

  if (!dryRun) {
    const memberInserts = replacements.map(r => ({
      group_id: groupId,
      user_id: r.user_id,
      status: 'pending',
      invited_at: new Date().toISOString(),
      is_replacement: true,
    }));

    const { error: insertError } = await supabase
      .from('pi_auto_group_members')
      .insert(memberInserts);

    if (insertError) return errorResponse(`Replacement insert failed: ${insertError.message}`, 500);

    const newDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('pi_auto_groups')
      .update({
        status: 'awaiting_replacement_vote',
        acceptance_deadline: newDeadline,
      })
      .eq('id', groupId);
  }

  return jsonResponse({
    replacements_found: replacements.length,
    group_id: groupId,
    replacements: replacements.map(r => ({
      user_id: r.user_id,
      name: stripName(r.full_name),
    })),
  });
}
