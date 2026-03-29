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
  return sanitized.length > max ? sanitized.substring(0, max) + '...' : sanitized;
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

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
