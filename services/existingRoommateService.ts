import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as Clipboard from 'expo-clipboard';
import { Share, Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const WEB_FORM_BASE = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/web/roommate-profile.html`
  : '';

export interface ExistingRoommateRecord {
  id: string;
  listingId: string;
  inviteToken: string;
  firstName?: string;
  sleepSchedule?: string;
  cleanliness?: number;
  smoking?: boolean;
  pets?: boolean;
  lifestyleTags?: string[];
  guestsFrequency?: string;
  noiseLevel?: string;
  profileCompleted: boolean;
  completedAt?: string;
}

function mapRecord(r: any): ExistingRoommateRecord {
  return {
    id: r.id,
    listingId: r.listing_id,
    inviteToken: r.invite_token,
    firstName: r.first_name,
    sleepSchedule: r.sleep_schedule,
    cleanliness: r.cleanliness,
    smoking: r.smoking,
    pets: r.pets,
    lifestyleTags: r.lifestyle_tags,
    guestsFrequency: r.guests_frequency,
    noiseLevel: r.noise_level,
    profileCompleted: r.profile_completed ?? false,
    completedAt: r.completed_at,
  };
}

export async function createExistingRoommateInvites(
  listingId: string,
  count: number,
): Promise<ExistingRoommateRecord[]> {
  if (!isSupabaseConfigured || count < 1) return [];

  const records = Array.from({ length: count }, () => ({ listing_id: listingId }));
  const { data, error } = await supabase
    .from('existing_roommates')
    .insert(records)
    .select();

  if (error) throw error;
  return (data || []).map(mapRecord);
}

export async function getExistingRoommatesForListing(
  listingId: string,
): Promise<ExistingRoommateRecord[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('existing_roommates')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapRecord);
}

export function getShareableLink(inviteToken: string): string {
  if (WEB_FORM_BASE) {
    return `${WEB_FORM_BASE}?token=${inviteToken}`;
  }
  return `https://rhome.app/roommate-profile?token=${inviteToken}`;
}

export async function shareRoommateLink(inviteToken: string, index: number): Promise<void> {
  const link = getShareableLink(inviteToken);
  const message = `Hey! I'm using Rhome to find a new roommate for our place. Can you fill out this quick form so we find someone compatible with both of us?\n\n${link}`;

  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(link);
    return;
  }

  try {
    await Share.share({
      message,
      title: 'Rhome — Roommate Preferences',
    });
  } catch {
    await Clipboard.setStringAsync(link);
  }
}

export async function deleteExistingRoommateInvite(recordId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('existing_roommates').delete().eq('id', recordId);
}

function getField(obj: any, snakeCase: string, camelCase: string): any {
  return obj[snakeCase] ?? obj[camelCase];
}

export function scoreRenterVsExistingRoommate(
  renterProfile: any,
  existingRoommate: any,
): { score: number; penalties: string[] } {
  let score = 100;
  const penalties: string[] = [];

  const rSleep = getField(renterProfile, 'sleep_schedule', 'sleepSchedule');
  const eSleep = getField(existingRoommate, 'sleep_schedule', 'sleepSchedule');
  if (rSleep && eSleep && rSleep !== eSleep && rSleep !== 'flexible' && eSleep !== 'flexible') {
    score -= 20;
    penalties.push(`Sleep schedule conflict: ${rSleep} vs ${eSleep}`);
  }

  const rClean = renterProfile.cleanliness;
  const eClean = existingRoommate.cleanliness;
  if (rClean && eClean) {
    const diff = Math.abs(rClean - eClean);
    if (diff >= 3) {
      score -= 25;
      penalties.push('Major cleanliness gap');
    } else if (diff === 2) {
      score -= 10;
      penalties.push('Moderate cleanliness difference');
    }
  }

  const rSmoke = renterProfile.smoking;
  const eSmoke = existingRoommate.smoking;
  if (rSmoke !== eSmoke && (rSmoke || eSmoke)) {
    score -= 30;
    penalties.push('Smoking preference conflict');
  }

  const rPets = renterProfile.pets;
  const ePets = existingRoommate.pets;
  if (rPets !== ePets && (rPets || ePets)) {
    score -= 15;
    penalties.push('Pet preference mismatch');
  }

  const rNoise = getField(renterProfile, 'noise_level', 'noiseLevel') || renterProfile.noise_tolerance;
  const eNoise = getField(existingRoommate, 'noise_level', 'noiseLevel');
  if (rNoise && eNoise) {
    const noiseMap: Record<string, number> = { quiet: 1, moderate: 2, lively: 3 };
    const diff = Math.abs((noiseMap[rNoise] ?? 2) - (noiseMap[eNoise] ?? 2));
    if (diff >= 2) {
      score -= 15;
      penalties.push('Noise level conflict');
    }
  }

  const eGuests = getField(existingRoommate, 'guests_frequency', 'guestsFrequency');
  const rTags = getField(renterProfile, 'lifestyle_tags', 'lifestyleTags');
  const rGuests = getField(renterProfile, 'guests_frequency', 'guestsFrequency') || renterProfile.guests;
  if (
    eGuests === 'rarely' &&
    (rTags?.includes?.('social') || rGuests === 'often')
  ) {
    score -= 10;
    penalties.push('Existing roommate prefers fewer guests');
  }

  return { score: Math.max(0, score), penalties };
}

export function calculateCombinedCompatibility(
  renterProfile: any,
  existingRoommates: any[],
  baseScore: number,
): {
  finalScore: number;
  existingRoommateScores: { name: string; score: number; penalties: string[] }[];
  lowestScore: number;
} {
  if (existingRoommates.length === 0) {
    return { finalScore: baseScore, existingRoommateScores: [], lowestScore: baseScore };
  }

  const roommateScores = existingRoommates.map((er) => {
    const { score, penalties } = scoreRenterVsExistingRoommate(renterProfile, er);
    const name = getField(er, 'first_name', 'firstName') || 'Existing roommate';
    return { name, score, penalties };
  });

  const allScores = [baseScore, ...roommateScores.map((r) => r.score)];
  const finalScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  const lowestScore = Math.min(...allScores);

  return { finalScore, existingRoommateScores: roommateScores, lowestScore };
}
