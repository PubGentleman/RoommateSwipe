import { StorageService } from '../utils/storage';
import { BOOST_PACKS } from '../utils/hostPricing';
import { Alert } from 'react-native';

export type BoostType = 'quick' | 'standard' | 'extended';

export interface BoostPack {
  id: string;
  quantity: number;
  pricePerBoost: number;
  totalPrice: number;
  discount: number;
  label: string;
  badge: string | null;
}

const allPacks: BoostPack[] = [
  ...BOOST_PACKS.quick,
  ...BOOST_PACKS.standard,
  ...BOOST_PACKS.extended,
];

function getBoostTypeFromPackId(packId: string): BoostType {
  if (packId.startsWith('quick')) return 'quick';
  if (packId.startsWith('std')) return 'standard';
  return 'extended';
}

export async function purchaseBoostPack(
  userId: string,
  packId: string,
): Promise<{ success: boolean; newBalance: { quick: number; standard: number; extended: number }; message: string }> {
  const pack = allPacks.find(p => p.id === packId);
  if (!pack) {
    return { success: false, newBalance: { quick: 0, standard: 0, extended: 0 }, message: 'Invalid pack' };
  }

  const boostType = getBoostTypeFromPackId(packId);

  const currentCredits = await StorageService.getBoostCredits(userId);
  currentCredits[boostType] += pack.quantity;
  await StorageService.updateBoostCredits(userId, currentCredits);

  await StorageService.recordBoostPurchase({
    userId,
    packId,
    boostType,
    quantity: pack.quantity,
    pricePerBoost: pack.pricePerBoost,
    totalPrice: pack.totalPrice,
  });

  return {
    success: true,
    newBalance: currentCredits,
    message: `${pack.quantity} ${boostType.charAt(0).toUpperCase() + boostType.slice(1)} Boost credits added!`,
  };
}

export async function useBoostCredit(
  userId: string,
  boostType: BoostType,
): Promise<{ success: boolean; remaining: number; message: string }> {
  const credits = await StorageService.getBoostCredits(userId);
  if (credits[boostType] <= 0) {
    return { success: false, remaining: 0, message: `No ${boostType} boost credits available` };
  }

  credits[boostType] -= 1;
  await StorageService.updateBoostCredits(userId, credits);

  return {
    success: true,
    remaining: credits[boostType],
    message: `Used 1 ${boostType} boost credit. ${credits[boostType]} remaining.`,
  };
}

export function getPacksForType(boostType: BoostType): BoostPack[] {
  return BOOST_PACKS[boostType].filter((p: BoostPack) => p.quantity > 1);
}

export function getFullPricePerBoost(boostType: BoostType): number {
  const singlePack = BOOST_PACKS[boostType].find((p: BoostPack) => p.quantity === 1);
  return singlePack?.pricePerBoost ?? 0;
}

export function calculateSavings(pack: BoostPack, boostType: BoostType): number {
  const fullPrice = getFullPricePerBoost(boostType);
  return Number(((fullPrice * pack.quantity) - pack.totalPrice).toFixed(2));
}

export function showPurchaseConfirmation(
  pack: BoostPack,
  boostType: BoostType,
  onConfirm: () => void,
): void {
  const savings = calculateSavings(pack, boostType);
  const fullPrice = getFullPricePerBoost(boostType);
  const savingsPercent = pack.discount;
  const typeLabel = boostType.charAt(0).toUpperCase() + boostType.slice(1);

  Alert.alert(
    `Purchase ${pack.quantity} ${typeLabel} Boosts`,
    `$${pack.totalPrice.toFixed(2)} ($${pack.pricePerBoost.toFixed(2)}/ea)\nYou save $${savings.toFixed(2)} (${savingsPercent}%)\n\nCredits never expire.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: `Purchase $${pack.totalPrice.toFixed(2)}`, onPress: onConfirm },
    ],
  );
}
