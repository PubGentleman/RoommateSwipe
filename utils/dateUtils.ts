export const formatDate = (iso: string): string => {
  if (iso === 'flexible') return 'Flexible';
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const getMaxSearchDate = (plan: 'basic' | 'plus' | 'elite'): string => {
  const days = plan === 'elite' ? 180 : plan === 'plus' ? 90 : 30;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const getTierLimit = (plan: 'basic' | 'plus' | 'elite'): 30 | 90 | 180 => {
  if (plan === 'elite') return 180;
  if (plan === 'plus') return 90;
  return 30;
};

export const isAtLeast18 = (dob: string): boolean => {
  const [year, month, day] = dob.split('T')[0].split('-').map(Number);
  const today = new Date();
  const age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  return age > 18 || (age === 18 && (m > 0 || (m === 0 && today.getDate() >= day)));
};

export const toISODate = (mmddyyyy: string): string => {
  const parts = mmddyyyy.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
};

export const fromISODate = (iso: string): string => {
  if (!iso) return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return '';
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
};
