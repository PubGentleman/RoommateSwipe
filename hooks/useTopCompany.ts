import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TopCompanyResult {
  isTopCompany: boolean;
  loading: boolean;
}

const MIN_ACCOUNT_AGE_MONTHS = 3;
const MIN_ACTIVE_LISTINGS = 5;
const MIN_REVIEWS = 10;
const MIN_RATING = 4.6;
const MIN_RESPONSE_RATE = 90;
const MAX_AVG_VACANCY_DAYS = 45;

export function useTopCompany(companyId: string | undefined): TopCompanyResult {
  const [isTopCompany, setIsTopCompany] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    checkTopCompany(companyId).then(result => {
      if (!cancelled) {
        setIsTopCompany(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [companyId]);

  return { isTopCompany, loading };
}

export async function checkTopCompany(companyId: string): Promise<boolean> {
  try {
    const { data: company } = await supabase
      .from('users')
      .select('created_at, host_type, response_rate, company_name, company_plan')
      .eq('id', companyId)
      .maybeSingle();

    if (!company || company.host_type !== 'company') return false;

    if (!company.company_name) return false;

    if (company.company_plan !== 'pro' && company.company_plan !== 'enterprise') return false;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - MIN_ACCOUNT_AGE_MONTHS);
    if (new Date(company.created_at) > cutoff) return false;

    if ((company.response_rate || 0) < MIN_RESPONSE_RATE) return false;

    const { data: listings } = await supabase
      .from('listings')
      .select('id, average_rating, review_count, status')
      .eq('host_id', companyId);

    if (!listings) return false;

    const activeListings = listings.filter(l => l.status === 'active' || l.status === 'published');
    if (activeListings.length < MIN_ACTIVE_LISTINGS) return false;

    const totalReviews = listings.reduce((sum, l) => sum + (l.review_count || 0), 0);
    if (totalReviews < MIN_REVIEWS) return false;

    const weightedSum = listings.reduce(
      (sum, l) => sum + (l.average_rating || 0) * (l.review_count || 0), 0
    );
    const weightedRating = totalReviews > 0 ? weightedSum / totalReviews : 0;
    if (weightedRating < MIN_RATING) return false;

    const listingIds = listings.map(l => l.id);
    if (listingIds.length > 0) {
      const { data: pipeline } = await supabase
        .from('listing_fill_pipeline')
        .select('days_vacant')
        .in('listing_id', listingIds);

      if (pipeline && pipeline.length > 0) {
        const avgVacancy = pipeline.reduce((sum, p) => sum + (p.days_vacant || 0), 0) / pipeline.length;
        if (avgVacancy > MAX_AVG_VACANCY_DAYS) return false;
      }
    }

    const { count: teamCount } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_user_id', companyId)
      .eq('status', 'active');

    if ((teamCount || 0) < 2) return false;

    return true;
  } catch (error) {
    console.error('Error checking Top Company:', error);
    return false;
  }
}
