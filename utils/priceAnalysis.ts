import { supabase } from '../lib/supabase';

interface PriceContext {
  listingPrice: number;
  bedrooms: number;
  zipCode: string;
  city: string;
}

interface PriceAnalysis {
  rhomeMedian: number | null;
  rhomeCount: number;
  rhomePercentile: number | null;
  hudFairMarketRent: number | null;
  comparedToMarket: 'below' | 'at' | 'above' | 'unknown';
  percentDifference: number | null;
  summary: string;
}

export async function analyzePrice(context: PriceContext): Promise<PriceAnalysis> {
  const { listingPrice, bedrooms, zipCode } = context;

  let rhomeMedian: number | null = null;
  let rhomeCount = 0;
  let rhomePercentile: number | null = null;

  try {
    const { data: comparables } = await supabase
      .from('listings')
      .select('rent')
      .eq('zip_code', zipCode)
      .eq('bedrooms', bedrooms)
      .eq('status', 'active')
      .order('rent', { ascending: true });

    if (comparables && comparables.length > 0) {
      rhomeCount = comparables.length;
      const prices = comparables.map(l => l.rent).sort((a: number, b: number) => a - b);
      rhomeMedian = prices[Math.floor(prices.length / 2)];

      const cheaperCount = prices.filter((p: number) => p < listingPrice).length;
      rhomePercentile = Math.round((cheaperCount / prices.length) * 100);
    }
  } catch {
    // Supabase query failed, continue with limited data
  }

  let hudFairMarketRent: number | null = null;
  try {
    const { data: hudData } = await supabase
      .from('fair_market_rents')
      .select('rent')
      .eq('zip_code', zipCode)
      .eq('bedrooms', bedrooms)
      .maybeSingle();

    hudFairMarketRent = hudData?.rent || null;
  } catch {
    // HUD table may not exist yet
  }

  const referencePrice = rhomeMedian || hudFairMarketRent;
  let comparedToMarket: 'below' | 'at' | 'above' | 'unknown' = 'unknown';
  let percentDifference: number | null = null;

  if (referencePrice) {
    percentDifference = Math.round(((listingPrice - referencePrice) / referencePrice) * 100);
    if (percentDifference < -5) comparedToMarket = 'below';
    else if (percentDifference > 5) comparedToMarket = 'above';
    else comparedToMarket = 'at';
  }

  let summary = '';
  if (rhomeMedian && rhomeCount >= 3) {
    summary += `Based on ${rhomeCount} similar ${bedrooms}BR listings on Rhome in this area, the median rent is $${rhomeMedian.toLocaleString()}/month. `;
    summary += `This listing at $${listingPrice.toLocaleString()} is `;
    if (percentDifference !== null) {
      if (comparedToMarket === 'below') {
        summary += `${Math.abs(percentDifference)}% below the median — that's a competitive price. `;
      } else if (comparedToMarket === 'above') {
        summary += `${percentDifference}% above the median — on the higher end for this area. `;
      } else {
        summary += `right around the median — fairly priced for this area. `;
      }
    }
    if (rhomePercentile !== null) {
      summary += `It's cheaper than ${100 - rhomePercentile}% of comparable listings. `;
    }
  } else if (rhomeCount > 0 && rhomeCount < 3) {
    summary += `There are only ${rhomeCount} other ${bedrooms}BR listings on Rhome in this zip code, so comparisons are limited. `;
  } else {
    summary += `There aren't enough comparable listings on Rhome in this area yet for a strong comparison. `;
  }

  if (hudFairMarketRent) {
    summary += `The HUD Fair Market Rent for a ${bedrooms}BR in this zip code is $${hudFairMarketRent.toLocaleString()}/month. `;
    const hudDiff = Math.round(((listingPrice - hudFairMarketRent) / hudFairMarketRent) * 100);
    if (hudDiff < -5) {
      summary += `This listing is ${Math.abs(hudDiff)}% below the government benchmark — a strong value.`;
    } else if (hudDiff > 15) {
      summary += `This listing is ${hudDiff}% above the government benchmark — typical for updated or premium units.`;
    } else {
      summary += `This listing is close to the government benchmark.`;
    }
  }

  if (!rhomeMedian && !hudFairMarketRent) {
    summary = `I don't have enough pricing data for this specific area yet. I'd suggest checking a few other listings nearby to get a sense of the going rate, and asking the host if the price is negotiable.`;
  }

  return {
    rhomeMedian,
    rhomeCount,
    rhomePercentile,
    hudFairMarketRent,
    comparedToMarket,
    percentDifference,
    summary,
  };
}

export function isPriceQuestion(message: string): boolean {
  const priceKeywords = [
    'good price', 'good deal', 'fair price', 'overpriced', 'worth it',
    'too expensive', 'too much', 'cheap', 'reasonable', 'market rate',
    'compare price', 'average rent', 'median rent', 'how much should',
    'is this a good', 'price analysis', 'rental price',
  ];
  const lower = message.toLowerCase();
  return priceKeywords.some(kw => lower.includes(kw));
}
