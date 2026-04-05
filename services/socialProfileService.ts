import { supabase } from '../lib/supabase';

export interface PublicProfile {
  slug: string;
  name: string;
  age?: number;
  tagline?: string;
  photo: string;
  bio?: string;
  occupation?: string;
  neighborhood?: string;
  city?: string;
  zodiacSign?: string;
  interests?: string[];
  verifications: string[];
  stats: {
    matchCount: number;
    groupCount: number;
    responseRate: number;
    memberSince: string;
  };
  testimonials: Testimonial[];
  traits: { trait: string; count: number }[];
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorPhoto?: string;
  relationship: string;
  content: string;
  rating: number;
  traits: string[];
  createdAt: string;
}

export async function getPublicProfile(slug: string): Promise<PublicProfile | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, age, profile_tagline, avatar_url, bio, occupation, neighborhood, city, zodiac_sign, profile_stats, public_profile_enabled, created_at, verification')
    .eq('profile_slug', slug)
    .eq('public_profile_enabled', true)
    .single();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('interests, instagram_verified')
    .eq('user_id', user.id)
    .single();

  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('id, content, rating, traits, relationship, created_at, author:users!author_id(full_name, avatar_url)')
    .eq('recipient_id', user.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10);

  const traitCounts: Record<string, number> = {};
  (testimonials || []).forEach((t: any) => {
    (t.traits || []).forEach((trait: string) => {
      traitCounts[trait] = (traitCounts[trait] || 0) + 1;
    });
  });

  const verifications: string[] = [];
  const vData = user.verification || {};
  if (vData.email) verifications.push('email');
  if (vData.phone) verifications.push('phone');
  if (profile?.instagram_verified) verifications.push('instagram');
  if (vData.backgroundCheck) verifications.push('background_check');

  return {
    slug,
    name: user.full_name,
    age: user.age,
    tagline: user.profile_tagline,
    photo: user.avatar_url,
    bio: user.bio,
    occupation: user.occupation,
    neighborhood: user.neighborhood,
    city: user.city,
    zodiacSign: user.zodiac_sign,
    interests: profile?.interests || [],
    verifications,
    stats: user.profile_stats || { matchCount: 0, groupCount: 0, responseRate: 0, memberSince: user.created_at },
    testimonials: (testimonials || []).map((t: any) => ({
      id: t.id,
      authorName: t.author?.full_name || 'Anonymous',
      authorPhoto: t.author?.avatar_url,
      relationship: t.relationship,
      content: t.content,
      rating: t.rating,
      traits: t.traits || [],
      createdAt: t.created_at,
    })),
    traits: Object.entries(traitCounts)
      .map(([trait, count]) => ({ trait, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function togglePublicProfile(userId: string, enabled: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ public_profile_enabled: enabled })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateTagline(userId: string, tagline: string) {
  const { error } = await supabase
    .from('users')
    .update({ profile_tagline: tagline.slice(0, 100) })
    .eq('id', userId);
  if (error) throw error;
}

export function getProfileShareLink(slug: string): string {
  return `https://rhome.app/u/${slug}`;
}

export async function trackProfileShare(userId: string, via: string, platform?: string) {
  await supabase.from('profile_shares').insert({
    user_id: userId,
    shared_via: via,
    platform,
  });
}

export async function getShareStats(userId: string): Promise<{ total: number; thisMonth: number }> {
  const { count: total } = await supabase
    .from('profile_shares')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const { count: thisMonth } = await supabase
    .from('profile_shares')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthAgo.toISOString());

  return { total: total || 0, thisMonth: thisMonth || 0 };
}

export async function refreshProfileStats(userId: string) {
  const { count: matchCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    .eq('status', 'matched');

  const { count: groupCount } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  const { data: user } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .single();

  await supabase
    .from('users')
    .update({
      profile_stats: {
        matchCount: matchCount || 0,
        groupCount: groupCount || 0,
        responseRate: 0,
        memberSince: user?.created_at,
      },
    })
    .eq('id', userId);
}

export async function writeTestimonial(
  authorId: string,
  recipientId: string,
  content: string,
  rating: number,
  relationship: string,
  traits: string[]
) {
  const { data, error } = await supabase
    .from('testimonials')
    .upsert({
      author_id: authorId,
      recipient_id: recipientId,
      content: content.slice(0, 500),
      rating: Math.min(5, Math.max(1, rating)),
      relationship,
      traits,
      status: 'pending',
    }, { onConflict: 'author_id,recipient_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTestimonialStatus(testimonialId: string, userId: string, status: 'approved' | 'hidden') {
  const { error } = await supabase
    .from('testimonials')
    .update({ status })
    .eq('id', testimonialId)
    .eq('recipient_id', userId);
  if (error) throw error;
}

export async function getPendingTestimonials(userId: string) {
  const { data } = await supabase
    .from('testimonials')
    .select('*, author:users!author_id(full_name, avatar_url)')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getReceivedTestimonials(userId: string) {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*, author:users!author_id(full_name, avatar_url)')
    .eq('recipient_id', userId)
    .in('status', ['approved', 'pending'])
    .order('created_at', { ascending: false });
  if (error) console.warn('getReceivedTestimonials error:', error.message);
  return data || [];
}

export async function getTestimonialsWrittenByMe(userId: string) {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*, recipient:users!recipient_id(full_name, avatar_url)')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });
  if (error) console.warn('getTestimonialsWrittenByMe error:', error.message);
  return data || [];
}

export async function canWriteTestimonial(authorId: string, recipientId: string): Promise<boolean> {
  const { count: matchCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`and(user_id_1.eq.${authorId},user_id_2.eq.${recipientId}),and(user_id_1.eq.${recipientId},user_id_2.eq.${authorId})`)
    .eq('status', 'matched');

  if (matchCount && matchCount > 0) return true;

  const { data: authorGroups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', authorId);

  if (authorGroups && authorGroups.length > 0) {
    const groupIds = authorGroups.map((g: any) => g.group_id);
    const { count: sharedGroup } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', recipientId)
      .in('group_id', groupIds);

    if (sharedGroup && sharedGroup > 0) return true;
  }

  return false;
}

export function getTraitEmoji(trait: string): string {
  const map: Record<string, string> = {
    clean: '\u2728',
    respectful: '\u{1F64F}',
    communicative: '\u{1F4AC}',
    fun: '\u{1F389}',
    reliable: '\u{1F4AA}',
    quiet: '\u{1F30A}',
    organized: '\u{1F4CB}',
    flexible: '\u{1F4A1}',
    friendly: '\u{1F60A}',
    considerate: '\u2764\uFE0F',
    honest: '\u{1F91D}',
    punctual: '\u23F0',
  };
  return map[trait.toLowerCase()] || '\u2B50';
}
