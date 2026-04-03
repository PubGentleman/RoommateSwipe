import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return errorResponse('Unauthorized', 401);

    const { placementId, groupId, listingId } = await req.json();
    if (!placementId) {
      return errorResponse('placementId is required', 400);
    }

    const { data: placement, error: updateError } = await supabase
      .from('agent_placements')
      .update({ billing_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', placementId)
      .eq('agent_id', user.id)
      .neq('billing_status', 'charged')
      .neq('billing_status', 'processing')
      .select()
      .single();

    if (updateError || !placement) {
      return errorResponse('Placement not found or already charged/processing', 400);
    }

    const amountCents = placement.placement_fee_cents;
    if (!amountCents || amountCents <= 0) {
      return errorResponse('Invalid placement fee', 400);
    }

    const { data: agentData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = agentData?.stripe_customer_id;

    if (!customerId) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: userRecord?.email,
        name: userRecord?.full_name,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: customerId,
        metadata: {
          type: 'agent_placement_fee',
          placement_id: placementId,
          group_id: groupId ?? '',
          listing_id: listingId ?? '',
          agent_id: user.id,
        },
        automatic_payment_methods: { enabled: true },
      });
    } catch (stripeErr) {
      await supabase
        .from('agent_placements')
        .update({ billing_status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', placementId);
      throw stripeErr;
    }

    await supabase
      .from('agent_placements')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        billing_status: 'pending',
      })
      .eq('id', placementId);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('Placement fee error:', err);
    return errorResponse('Failed to create payment', 500);
  }
});

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
