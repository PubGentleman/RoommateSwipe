export const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'aim.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'zoho.com',
  'zohomail.com',
  'mail.com',
  'email.com',
  'inbox.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'tutanota.com',
  'tuta.io',
  'fastmail.com',
  'hushmail.com',
  'mailfence.com',
  'runbox.com',
  'posteo.de',
  'hey.com',
];

export function isPersonalEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return true;
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}
