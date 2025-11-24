import type { ZodiacSign } from '../types/models';

export interface ZodiacInfo {
  name: ZodiacSign;
  symbol: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
}

export const ZODIAC_SIGNS: ZodiacInfo[] = [
  { name: 'Aries', symbol: '♈', element: 'Fire' },
  { name: 'Taurus', symbol: '♉', element: 'Earth' },
  { name: 'Gemini', symbol: '♊', element: 'Air' },
  { name: 'Cancer', symbol: '♋', element: 'Water' },
  { name: 'Leo', symbol: '♌', element: 'Fire' },
  { name: 'Virgo', symbol: '♍', element: 'Earth' },
  { name: 'Libra', symbol: '♎', element: 'Air' },
  { name: 'Scorpio', symbol: '♏', element: 'Water' },
  { name: 'Sagittarius', symbol: '♐', element: 'Fire' },
  { name: 'Capricorn', symbol: '♑', element: 'Earth' },
  { name: 'Aquarius', symbol: '♒', element: 'Air' },
  { name: 'Pisces', symbol: '♓', element: 'Water' },
];

export const getZodiacInfo = (sign: ZodiacSign): ZodiacInfo | undefined => {
  return ZODIAC_SIGNS.find(z => z.name === sign);
};

export const getZodiacSymbol = (sign: ZodiacSign): string => {
  const info = getZodiacInfo(sign);
  return info?.symbol || '';
};

export const getZodiacElement = (sign: ZodiacSign): 'Fire' | 'Earth' | 'Air' | 'Water' | undefined => {
  const info = getZodiacInfo(sign);
  return info?.element;
};

export type ZodiacCompatibilityLevel = 'Good' | 'Neutral' | 'Low';

export const calculateZodiacCompatibility = (
  sign1: ZodiacSign,
  sign2: ZodiacSign
): ZodiacCompatibilityLevel => {
  const element1 = getZodiacElement(sign1);
  const element2 = getZodiacElement(sign2);
  
  if (!element1 || !element2) return 'Neutral';
  
  if (element1 === element2) {
    return 'Good';
  }
  
  const compatiblePairs: Record<string, string[]> = {
    'Fire': ['Air'],
    'Air': ['Fire'],
    'Earth': ['Water'],
    'Water': ['Earth'],
  };
  
  if (compatiblePairs[element1]?.includes(element2)) {
    return 'Good';
  }
  
  const conflictingPairs: Record<string, string[]> = {
    'Fire': ['Water'],
    'Water': ['Fire'],
    'Earth': ['Air'],
    'Air': ['Earth'],
  };
  
  if (conflictingPairs[element1]?.includes(element2)) {
    return 'Low';
  }
  
  return 'Neutral';
};

export const getZodiacCompatibilityScore = (
  sign1?: ZodiacSign,
  sign2?: ZodiacSign
): number => {
  if (!sign1 || !sign2) return 0;
  
  const compatibility = calculateZodiacCompatibility(sign1, sign2);
  
  switch (compatibility) {
    case 'Good':
      return 2;
    case 'Neutral':
      return 1;
    case 'Low':
      return 0;
    default:
      return 0;
  }
};

export const getZodiacCompatibilityLevel = (
  sign1: ZodiacSign,
  sign2: ZodiacSign
): string => {
  const element1 = getZodiacElement(sign1);
  const element2 = getZodiacElement(sign2);
  const compatibility = calculateZodiacCompatibility(sign1, sign2);
  
  if (!element1 || !element2) {
    return 'Zodiac compatibility could not be determined.';
  }
  
  switch (compatibility) {
    case 'Good':
      if (element1 === element2) {
        return `Great compatibility! Both ${sign1} and ${sign2} share the ${element1} element, creating natural harmony and understanding between you.`;
      } else {
        return `Strong compatibility! ${sign1} (${element1}) and ${sign2} (${element2}) complement each other well, with ${element1} and ${element2} elements working in harmony.`;
      }
    case 'Neutral':
      return `Moderate compatibility. ${sign1} (${element1}) and ${sign2} (${element2}) have neutral elemental energy that can work together with mutual understanding and effort.`;
    case 'Low':
      return `Challenging compatibility. ${sign1} (${element1}) and ${sign2} (${element2}) have conflicting elemental energies, which may require extra patience and compromise to navigate successfully.`;
    default:
      return 'Zodiac compatibility is neutral.';
  }
};
