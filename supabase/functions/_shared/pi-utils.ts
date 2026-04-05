const PII_DENYLIST_KEYS = new Set([
  'id', 'user_id', 'email', 'password', 'password_hash', 'token', 'refresh_token',
  'stripe_customer_id', 'stripe_subscription_id', 'revenuecat_id',
  'phone', 'phone_number', 'address', 'full_address', 'street_address',
  'ssn', 'social_security', 'ip_address', 'device_id',
  'created_at', 'updated_at', 'deleted_at', 'last_sign_in_at',
  'avatar_url', 'photo_urls', 'photos', 'profile_photo',
  'fcm_token', 'push_token', 'api_key', 'secret',
  'instagram_handle', 'instagram_token', 'instagram_verified',
  'background_check_id', 'background_check_status',
  'referral_code', 'affiliate_code', 'paypal_email',
  'agent_license_number', 'agent_license_state', 'agent_license_document_url',
]);

export function sanitizeValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  let cleaned = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted]');
  cleaned = cleaned.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[redacted]');
  cleaned = cleaned.replace(/\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Cir|Circle)\b/gi, '[redacted]');
  cleaned = cleaned.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted]');
  return cleaned;
}

export function stripName(name: string | null | undefined): string {
  if (!name) return 'User';
  return name.split(' ')[0] || 'User';
}

export function trimAndSanitize(text: string | null | undefined, max = 500): string {
  if (!text) return '';
  const sanitized = sanitizeValue(text);
  const capped = Math.min(max, 500);
  return sanitized.length > capped ? sanitized.substring(0, capped) + '...' : sanitized;
}

export function serializeFullContext(
  userData: Record<string, any> | null,
  profileData: Record<string, any> | null,
  label: string
): string {
  const lines: string[] = [`${label}:`];

  if (userData) {
    lines.push(`- Name: ${stripName(userData.full_name)}`);
    for (const [key, value] of Object.entries(userData)) {
      if (PII_DENYLIST_KEYS.has(key)) continue;
      if (key === 'full_name') continue;
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object' && Object.keys(value).length === 0) continue;
      if (Array.isArray(value) && value.length === 0) continue;

      const displayValue = typeof value === 'string'
        ? trimAndSanitize(value, 400)
        : Array.isArray(value)
          ? value.map(v => typeof v === 'string' ? sanitizeValue(v) : v).join(', ')
          : typeof value === 'boolean'
            ? (value ? 'yes' : 'no')
            : String(value);

      lines.push(`- ${key}: ${displayValue}`);
    }
  }

  if (profileData) {
    for (const [key, value] of Object.entries(profileData)) {
      if (PII_DENYLIST_KEYS.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      if (Array.isArray(value) && value.length === 0) continue;

      const displayValue = typeof value === 'string'
        ? trimAndSanitize(value, 400)
        : Array.isArray(value)
          ? value.map(v => typeof v === 'string' ? sanitizeValue(v) : v).join(', ')
          : typeof value === 'object'
            ? trimAndSanitize(JSON.stringify(value), 400)
            : typeof value === 'boolean'
              ? (value ? 'yes' : 'no')
              : String(value);

      lines.push(`- ${key}: ${displayValue}`);
    }
  }

  return lines.join('\n');
}

export function serializeCompactContext(
  userId: string,
  userData: Record<string, any> | null,
  profileData: Record<string, any> | null,
  score: number
): string {
  const lines: string[] = [];
  const u = userData || {};
  const p = profileData || {};

  lines.push(`[${userId}] ${stripName(u.full_name)}, ${u.age || '?'}yo, ${u.occupation || '?'} | Score: ${score}`);

  const allData = { ...u, ...p };
  for (const [key, value] of Object.entries(allData)) {
    if (PII_DENYLIST_KEYS.has(key)) continue;
    if (key === 'full_name') continue;
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    const displayValue = typeof value === 'string'
      ? trimAndSanitize(value, 300)
      : Array.isArray(value)
        ? value.map(v => typeof v === 'string' ? sanitizeValue(v) : v).join(', ')
        : typeof value === 'object'
          ? trimAndSanitize(JSON.stringify(value), 300)
          : typeof value === 'boolean'
            ? (value ? 'Y' : 'N')
            : String(value);

    lines.push(`  ${key}: ${displayValue}`);
  }

  return lines.join('\n');
}

export const PI_MATCH_INSIGHT_PERSONA = `You are Pi, Rhome's AI matchmaker. You're warm, perceptive, and genuinely invested in helping people find their ideal living situation. You speak with quiet confidence — never salesy, never robotic. You notice the small things in profiles that algorithms miss: the night owl who also loves sunrise yoga, the neat freak who's actually just anxious about shared spaces. You're honest about concerns but always frame them constructively. Your tone is like a thoughtful friend who happens to be incredibly good at reading people.`;

export const PI_RERANK_PERSONA = `You are Pi, Rhome's AI matchmaker. You're re-ranking a discovery deck of potential roommates. The deterministic algorithm already scored them on budget, location, sleep, cleanliness, smoking, pets, and timeline. Your job is to look at what the algorithm CAN'T score: bio nuance, occupation compatibility, personality quiz alignment, amenity priorities, transit needs, diet preferences, social style, and the intangible "would these people actually vibe?" factor. You're not replacing the algorithm — you're adding human-like intuition on top.`;

export const PI_PARSE_PERSONA = `You are Pi, Rhome's AI matchmaker. You're reading someone's free-text description of their ideal roommate situation and extracting structured preferences. Be generous in interpretation — people express preferences in many ways. "I need my beauty sleep" means early sleeper. "I throw dinner parties" means frequent guests. "No drama" might signal preference for a respectful/parallel roommate relationship. Extract everything you can, but never fabricate preferences that aren't implied.`;

export const PI_HOST_PERSONA = `You are Pi, Rhome's AI matchmaker — now helping from the host's perspective. You're analyzing renters and groups who might be great fits for a specific listing. You understand what makes a tenancy work: financial reliability, lifestyle compatibility with the building/neighborhood, timing alignment, and group dynamics. You're practical but warm — you want both the host and the renters to have a great experience. When recommending, you consider the whole picture: can they afford it, will they be happy there, and will the host feel confident about them?`;

export const PI_AUTO_ASSEMBLE_PERSONA = `You are Pi, Rhome's AI matchmaker. You're validating a candidate roommate group that the algorithm assembled. Your job is to look beyond the numbers and assess whether these specific people would actually thrive living together. Consider personality dynamics, lifestyle rhythm compatibility, potential friction points, and the overall group chemistry. Be honest — it's better to reject a marginal group now than to create a bad living situation. But also be fair — don't be overly picky about minor differences.`;

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface PiNotificationData {
  groupId: string;
  memberNames?: string[];
  groupScore?: number;
  acceptedBy?: string;
  declinedBy?: string;
  deadline?: string;
  city?: string;
  memberCount?: number;
  spotsNeeded?: number;
  replacementName?: string;
  compatibilityScore?: number;
}

export type PiNotificationType =
  | 'pi_group_assembled'
  | 'pi_member_accepted'
  | 'pi_group_confirmed'
  | 'pi_member_declined'
  | 'pi_group_expired'
  | 'pi_replacement_found'
  | 'pi_agent_new_group'
  | 'pi_deadline_reminder'
  | 'pi_replacement_vote'
  | 'pi_replacement_approved'
  | 'pi_replacement_invited'
  | 'pi_no_replacement'
  | 'pi_group_dissolved_member';

const PI_TEMPLATES: Record<PiNotificationType, {
  title: (d: PiNotificationData) => string;
  body: (d: PiNotificationData) => string;
}> = {
  pi_group_assembled: {
    title: () => 'Pi found your roommates!',
    body: (d) => {
      const names = d.memberNames?.join(' & ') || 'your matches';
      const score = d.groupScore ? ` ${d.groupScore}% compatible.` : '';
      return `Meet ${names} --${score} I put this group together because I think you'd genuinely enjoy living together. You have 72 hours to say yes.`;
    },
  },
  pi_member_accepted: {
    title: () => 'Someone said yes!',
    body: (d) => {
      const name = d.acceptedBy || 'A group member';
      return `${name} is in! They liked what they saw and want to be part of this group. Waiting on the others now.`;
    },
  },
  pi_group_confirmed: {
    title: () => 'Your group is official!',
    body: (d) => {
      const names = d.memberNames?.join(', ') || 'Everyone';
      return `${names} -- everyone said yes. Your Pi-matched group is now active and ready to start the apartment search together.`;
    },
  },
  pi_member_declined: {
    title: () => 'A member passed',
    body: (d) => {
      const name = d.declinedBy || 'A group member';
      return `${name} decided this group wasn't the right fit. I'm already looking for someone who'd be a great replacement.`;
    },
  },
  pi_group_expired: {
    title: () => 'Group timed out',
    body: () => `This group's acceptance window has closed. Don't worry -- I'm still working behind the scenes to find your ideal roommates. I'll reach out when I have another strong match.`,
  },
  pi_replacement_found: {
    title: () => 'Looking for a replacement',
    body: (d) => {
      const count = d.memberCount || 2;
      const spots = d.spotsNeeded || 1;
      return `Not everyone in your group responded in time, but ${count} of you said yes. I'm looking for ${spots === 1 ? 'a replacement' : `${spots} replacements`} to complete the group.`;
    },
  },
  pi_agent_new_group: {
    title: () => 'New Pi-matched group available',
    body: (d) => {
      const city = d.city || 'your area';
      const count = d.memberCount || 2;
      return `A new ${count}-person group just matched in ${city}. They're pre-vetted and compatible -- claim them before another host does.`;
    },
  },
  pi_deadline_reminder: {
    title: () => 'Your Pi match is waiting!',
    body: (d) => {
      const names = d.memberNames?.join(' and ');
      return names
        ? `${names} already accepted -- 24 hours left to respond.`
        : `Your potential roommates are waiting -- 24 hours left to respond.`;
    },
  },
  pi_replacement_vote: {
    title: (d) => `${d.declinedBy || 'A member'} passed on the group`,
    body: () => `Pi found a potential replacement -- tap to review and vote.`,
  },
  pi_replacement_approved: {
    title: () => 'Replacement approved!',
    body: (d) => `${d.replacementName || 'Your new match'} has been invited to join your group.`,
  },
  pi_replacement_invited: {
    title: () => 'Pi found your roommates!',
    body: (d) => {
      const names = d.memberNames?.join(' and ') || 'your matches';
      const score = d.compatibilityScore ? ` ${d.compatibilityScore}% compatible.` : '';
      return `Meet ${names} --${score} Tap to see why Pi thinks you'd be great together.`;
    },
  },
  pi_no_replacement: {
    title: () => "Pi couldn't find a replacement",
    body: () => "No compatible matches available right now. Your group has been dissolved -- Pi will keep looking for new groups.",
  },
  pi_group_dissolved_member: {
    title: () => 'Group dissolved',
    body: () => "A member chose to start fresh. Don't worry -- Pi is still looking for your perfect roommates.",
  },
};

export function getPiNotifContent(
  type: PiNotificationType,
  data: PiNotificationData
): { title: string; body: string } {
  const template = PI_TEMPLATES[type];
  return { title: template.title(data), body: template.body(data) };
}

export async function sendPushNotifications(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  pushData: Record<string, any>
): Promise<number> {
  const { data: pushTokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!pushTokens || pushTokens.length === 0) return 0;

  let sent = 0;
  for (const tokenRow of pushTokens) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tokenRow.token,
          title,
          body,
          data: pushData,
          sound: 'default',
          badge: 1,
        }),
      });
      sent++;
    } catch (err) {
      console.error('Push send error:', err);
    }
  }
  return sent;
}

export function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (authHeader === `Bearer ${serviceKey}`) return true;

  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  if (!cronSecret || cronSecret.length < 32) return false;

  const token = authHeader.replace('Bearer ', '');
  if (token.length !== cronSecret.length) return false;

  const encoder = new TextEncoder();
  const a = encoder.encode(token);
  const b = encoder.encode(cronSecret);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
