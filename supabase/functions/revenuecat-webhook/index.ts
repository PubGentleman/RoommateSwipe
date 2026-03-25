import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ENTITLEMENT_TO_PLAN: Record<string, { plan: string; planType: 'renter' | 'host' }> = {
  plus: { plan: 'plus', planType: 'renter' },
  elite: { plan: 'elite', planType: 'renter' },
  host_starter: { plan: 'starter', planType: 'host' },
  host_pro: { plan: 'pro', planType: 'host' },
  host_business: { plan: 'business', planType: 'host' },
  host_agent_starter: { plan: 'agent_starter', planType: 'host' },
  host_agent_pro: { plan: 'agent_pro', planType: 'host' },
  host_agent_business: { plan: 'agent_business', planType: 'host' },
  host_company_starter: { plan: 'company_starter', planType: 'host' },
  host_company_pro: { plan: 'company_pro', planType: 'host' },
};

const HOST_TO_RENTER_BUNDLE: Record<string, string> = {
  starter: 'plus',
  pro: 'elite',
  business: 'elite',
  agent_starter: 'free',
  agent_pro: 'free',
  agent_business: 'free',
  company_starter: 'free',
  company_pro: 'free',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();
    const event = body.event;
    const appUserId = event?.app_user_id;

    if (!appUserId || appUserId.startsWith('$RCAnonymousID:')) {
      return new Response(JSON.stringify({ ok: true, skipped: 'anonymous user' }), { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const eventType = event?.type || body.type;

    const entitlements = event?.entitlement_ids || [];
    let activePlan: { plan: string; planType: 'renter' | 'host' } | null = null;

    for (const ent of ['host_agent_business', 'host_agent_pro', 'host_agent_starter', 'host_company_pro', 'host_company_starter', 'host_business', 'host_pro', 'host_starter', 'elite', 'plus']) {
      if (entitlements.includes(ent)) {
        activePlan = ENTITLEMENT_TO_PLAN[ent];
        break;
      }
    }

    const isActive = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'PRODUCT_CHANGE',
      'UNCANCELLATION',
      'SUBSCRIPTION_EXTENDED',
    ].includes(eventType);

    const isCancelled = [
      'CANCELLATION',
      'EXPIRATION',
      'BILLING_ISSUE',
      'SUBSCRIPTION_PAUSED',
    ].includes(eventType);

    if (isActive && activePlan) {
      const expiresAt = event?.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;

      if (activePlan.planType === 'renter') {
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: appUserId,
            plan: activePlan.plan,
            status: 'active',
            provider: 'revenuecat',
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        await supabase
          .from('profiles')
          .update({
            host_tier: 'none',
            renter_tier: activePlan.plan,
            subscription_source: 'renter',
          })
          .eq('user_id', appUserId);
      } else {
        await supabase
          .from('host_subscriptions')
          .upsert({
            user_id: appUserId,
            plan: activePlan.plan,
            status: 'active',
            provider: 'revenuecat',
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        const bundledRenter = HOST_TO_RENTER_BUNDLE[activePlan.plan] || 'free';
        await supabase
          .from('profiles')
          .update({
            host_tier: activePlan.plan,
            renter_tier: bundledRenter,
            subscription_source: 'host',
          })
          .eq('user_id', appUserId);
      }
    } else if (isCancelled) {
      const expiresAt = event?.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : new Date().toISOString();

      await supabase
        .from('subscriptions')
        .update({
          status: eventType === 'EXPIRATION' ? 'expired' : 'cancelled',
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', appUserId)
        .eq('provider', 'revenuecat');

      await supabase
        .from('host_subscriptions')
        .update({
          status: eventType === 'EXPIRATION' ? 'expired' : 'cancelled',
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', appUserId)
        .eq('provider', 'revenuecat');

      await supabase
        .from('profiles')
        .update({
          host_tier: 'none',
          renter_tier: 'free',
          subscription_source: 'none',
        })
        .eq('user_id', appUserId);
    }

    return new Response(JSON.stringify({ ok: true, event: eventType }), { status: 200 });
  } catch (err) {
    console.error('RevenueCat webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
