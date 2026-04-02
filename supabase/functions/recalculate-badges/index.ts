import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: hosts } = await supabase
      .from('users')
      .select('id, host_type, created_at, response_rate, license_verification_status, agent_plan, company_name, company_plan')
      .in('host_type', ['individual', 'agent', 'company']);

    if (!hosts) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updated = 0;

    for (const host of hosts) {
      let badge: string | null = null;

      if (host.host_type === 'individual') {
        badge = await checkRhomeSelectServer(supabase, host);
      } else if (host.host_type === 'agent') {
        badge = await checkTopAgentServer(supabase, host);
      } else if (host.host_type === 'company') {
        badge = await checkTopCompanyServer(supabase, host);
      }

      await supabase
        .from('users')
        .update({ host_badge: badge })
        .eq('id', host.id);

      await supabase
        .from('listings')
        .update({ host_badge: badge })
        .eq('host_id', host.id);

      updated++;
    }

    return new Response(JSON.stringify({ updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function checkRhomeSelectServer(supabase: any, host: any): Promise<string | null> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  if (new Date(host.created_at) > threeMonthsAgo) return null;

  if (host.response_rate !== null && host.response_rate < 90) return null;

  const { data: listings } = await supabase
    .from('listings')
    .select('average_rating, review_count')
    .eq('host_id', host.id);

  if (!listings || listings.length === 0) return null;

  const totalReviews = listings.reduce((sum: number, l: any) => sum + (l.review_count || 0), 0);
  const weightedRating = listings.reduce((sum: number, l: any) =>
    sum + (l.average_rating || 0) * (l.review_count || 0), 0
  ) / (totalReviews || 1);

  if (totalReviews < 10 || weightedRating < 4.8) return null;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('status')
    .eq('host_id', host.id);

  if (!bookings || bookings.length === 0) return null;

  const confirmed = bookings.filter((b: any) => b.status === 'confirmed');
  if (confirmed.length === 0) return null;

  const cancelledByHost = bookings.filter((b: any) => b.status === 'cancelled_by_host').length;
  if (cancelledByHost / bookings.length >= 0.1) return null;

  return 'rhome_select';
}

async function checkTopAgentServer(supabase: any, host: any): Promise<string | null> {
  if (host.license_verification_status !== 'verified') return null;
  if (host.agent_plan === 'pay_per_use' || !host.agent_plan) return null;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 2);
  if (new Date(host.created_at) > cutoff) return null;

  const { count: inquiryCount } = await supabase
    .from('interest_cards')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', host.id);

  if ((inquiryCount || 0) < 10) return null;
  if ((host.response_rate || 0) < 85) return null;

  const { count: placementCount } = await supabase
    .from('agent_placements')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', host.id)
    .eq('billing_status', 'charged');

  if ((placementCount || 0) < 3) return null;

  const { data: listings } = await supabase
    .from('listings')
    .select('id, average_rating, review_count')
    .eq('host_id', host.id);

  if (!listings || listings.length === 0) return null;

  const totalReviews = listings.reduce((sum: number, l: any) => sum + (l.review_count || 0), 0);
  if (totalReviews < 5) return null;

  const weightedSum = listings.reduce((sum: number, l: any) =>
    sum + (l.average_rating || 0) * (l.review_count || 0), 0
  );
  if (totalReviews > 0 && weightedSum / totalReviews < 4.7) return null;

  if ((placementCount || 0) < 5) return null;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('status')
    .in('listing_id', listings.map((l: any) => l.id));

  if (bookings && bookings.length > 0) {
    const cancelledByHost = bookings.filter((b: any) => b.status === 'cancelled_by_host').length;
    if (cancelledByHost / bookings.length >= 0.15) return null;
  }

  return 'top_agent';
}

async function checkTopCompanyServer(supabase: any, host: any): Promise<string | null> {
  if (!host.company_name) return null;
  if (host.company_plan !== 'pro' && host.company_plan !== 'enterprise') return null;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  if (new Date(host.created_at) > cutoff) return null;

  const { count: companyInquiryCount } = await supabase
    .from('interest_cards')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', host.id);

  if ((companyInquiryCount || 0) < 15) return null;
  if ((host.response_rate || 0) < 90) return null;

  const { data: listings } = await supabase
    .from('listings')
    .select('id, average_rating, review_count, status')
    .eq('host_id', host.id);

  if (!listings) return null;

  const activeListings = listings.filter((l: any) => l.status === 'active' || l.status === 'published');
  if (activeListings.length < 5) return null;

  const totalReviews = listings.reduce((sum: number, l: any) => sum + (l.review_count || 0), 0);
  if (totalReviews < 10) return null;

  const weightedSum = listings.reduce((sum: number, l: any) =>
    sum + (l.average_rating || 0) * (l.review_count || 0), 0
  );
  if (totalReviews > 0 && weightedSum / totalReviews < 4.6) return null;

  const listingIds = listings.map((l: any) => l.id);
  if (listingIds.length > 0) {
    const { data: pipeline } = await supabase
      .from('listing_fill_pipeline')
      .select('days_vacant')
      .in('listing_id', listingIds);

    if (pipeline && pipeline.length > 0) {
      const avgVacancy = pipeline.reduce((sum: number, p: any) => sum + (p.days_vacant || 0), 0) / pipeline.length;
      if (avgVacancy > 45) return null;
    }
  }

  const { count: teamCount } = await supabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('company_user_id', host.id)
    .eq('status', 'active');

  if ((teamCount || 0) < 2) return null;

  return 'top_company';
}
