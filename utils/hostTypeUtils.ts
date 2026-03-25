export type HostType = 'individual' | 'company' | 'agent';

export function shouldShowMatchScore(hostType: HostType): boolean {
  return hostType === 'individual';
}

export function getHostBadgeLabel(hostType: HostType): string {
  switch (hostType) {
    case 'company': return 'Property Management';
    case 'agent':   return 'Licensed Agent';
    default:        return '';
  }
}

export function getHostBadgeColor(hostType: HostType): string {
  switch (hostType) {
    case 'company': return '#22C55E';
    case 'agent':   return '#F59E0B';
    default:        return '';
  }
}

export function getHostBadgeIcon(hostType: HostType): string {
  switch (hostType) {
    case 'company': return 'briefcase';
    case 'agent':   return 'award';
    default:        return 'user';
  }
}

export function getContactLabel(hostType: HostType): string {
  switch (hostType) {
    case 'company': return 'Contact Company';
    case 'agent':   return 'Contact Agent';
    default:        return 'Send Message';
  }
}

export function isHostTypeEditable(hostTypeLockedAt: string | null | undefined): boolean {
  if (!hostTypeLockedAt) return true;
  const lockedAt = new Date(hostTypeLockedAt);
  if (isNaN(lockedAt.getTime())) return true;
  const now = new Date();
  const hoursSinceLock = (now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceLock <= 24;
}

export function hoursRemainingInGracePeriod(hostTypeLockedAt: string | null | undefined): number {
  if (!hostTypeLockedAt) return 24;
  const lockedAt = new Date(hostTypeLockedAt);
  if (isNaN(lockedAt.getTime())) return 24;
  const now = new Date();
  const hoursSinceLock = (now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60);
  return Math.max(0, Math.ceil(24 - hoursSinceLock));
}

export function getDisplayName(user: { hostType?: HostType; companyName?: string; name: string }): string {
  if (user.hostType === 'company' && user.companyName) {
    return user.companyName;
  }
  return user.name;
}
