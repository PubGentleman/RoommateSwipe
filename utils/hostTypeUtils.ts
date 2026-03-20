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
