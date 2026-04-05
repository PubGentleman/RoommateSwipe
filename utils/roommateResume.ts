import type { PublicProfile } from '../services/socialProfileService';
import { getProfileShareLink, getTraitEmoji } from '../services/socialProfileService';

export function generateResumeText(profile: PublicProfile): string {
  const lines: string[] = [];

  lines.push('--- Roommate Resume ---');
  lines.push('');

  let nameLine = profile.name;
  if (profile.age) nameLine += `, ${profile.age}`;
  if (profile.occupation) nameLine += ` | ${profile.occupation}`;
  lines.push(nameLine);

  if (profile.tagline) {
    lines.push(`"${profile.tagline}"`);
  }
  lines.push('');

  if (profile.neighborhood || profile.city) {
    const location = [profile.neighborhood, profile.city].filter(Boolean).join(', ');
    lines.push(`Location: ${location}`);
  }

  if (profile.bio) {
    lines.push('');
    lines.push(profile.bio);
  }

  if (profile.interests && profile.interests.length > 0) {
    lines.push('');
    lines.push(`Interests: ${profile.interests.slice(0, 5).join(', ')}`);
  }

  if (profile.traits.length > 0) {
    lines.push('');
    const traitStr = profile.traits.slice(0, 5).map(t => `${getTraitEmoji(t.trait)} ${t.trait}`).join(' | ');
    lines.push(traitStr);
  }

  if (profile.verifications.length > 0) {
    lines.push('');
    const vStr = profile.verifications.map(v => {
      if (v === 'email') return 'Email verified';
      if (v === 'phone') return 'Phone verified';
      if (v === 'instagram') return 'Instagram verified';
      if (v === 'background_check') return 'Background checked';
      return v;
    }).join(' | ');
    lines.push(vStr);
  }

  if (profile.stats.matchCount > 0 || profile.stats.groupCount > 0) {
    lines.push('');
    const stats = [];
    if (profile.stats.matchCount > 0) stats.push(`${profile.stats.matchCount} matches`);
    if (profile.stats.groupCount > 0) stats.push(`${profile.stats.groupCount} groups`);
    lines.push(stats.join(' | '));
  }

  if (profile.testimonials.length > 0) {
    lines.push('');
    const top = profile.testimonials[0];
    lines.push(`"${top.content.slice(0, 120)}${top.content.length > 120 ? '...' : ''}" - ${top.authorName}`);
  }

  lines.push('');
  lines.push(`Find me on Rhome: ${getProfileShareLink(profile.slug)}`);
  lines.push('------------------------');

  return lines.join('\n');
}
