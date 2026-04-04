import type { VerificationStatus, TrustScore } from '../types/models';

export function calculateTrustScore(
  verification: VerificationStatus | undefined,
  backgroundCheckStatus: string | undefined,
  avgRating: number | null | undefined,
  reviewCount: number | undefined,
  createdAt: string | undefined,
  selfieVerified: boolean | undefined
): TrustScore {
  const breakdown = {
    phoneVerified: verification?.phone?.verified ? 15 : 0,
    idVerified: verification?.government_id?.verified ? 25 : 0,
    selfieVerified: selfieVerified ? 15 : 0,
    socialVerified: verification?.social_media?.verified ? 10 : 0,
    backgroundCheck: backgroundCheckStatus === 'clear' ? 20 : 0,
    reviewScore: calculateReviewPoints(avgRating, reviewCount),
    accountAge: calculateAccountAgePoints(createdAt),
  };

  const overall = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  let level: TrustScore['level'] = 'unverified';
  let badgeColor = '#95A5A6';
  if (overall >= 85) { level = 'fully_trusted'; badgeColor = '#27AE60'; }
  else if (overall >= 65) { level = 'trusted'; badgeColor = '#2563EB'; }
  else if (overall >= 40) { level = 'verified'; badgeColor = '#6C5CE7'; }
  else if (overall >= 15) { level = 'basic'; badgeColor = '#F39C12'; }

  return { overall, breakdown, level, badgeColor };
}

function calculateReviewPoints(avgRating: number | null | undefined, count: number | undefined): number {
  if (!avgRating || !count || count === 0) return 0;
  if (count >= 5 && avgRating >= 4.0) return 10;
  if (count >= 3 && avgRating >= 3.5) return 7;
  if (count >= 1 && avgRating >= 3.0) return 4;
  return 2;
}

function calculateAccountAgePoints(createdAt: string | undefined): number {
  if (!createdAt) return 0;
  const months = (Date.now() - new Date(createdAt).getTime()) / (30 * 24 * 3600 * 1000);
  if (months >= 12) return 5;
  if (months >= 6) return 3;
  if (months >= 1) return 1;
  return 0;
}

export function getTrustLevelLabel(level: TrustScore['level']): string {
  switch (level) {
    case 'fully_trusted': return 'Fully Trusted';
    case 'trusted': return 'Trusted';
    case 'verified': return 'Verified';
    case 'basic': return 'Basic';
    default: return 'Not Verified';
  }
}
