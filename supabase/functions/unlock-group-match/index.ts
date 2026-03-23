import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Unauthorized', 401);

  const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (!user) return errorResponse('Unauthorized', 401);

  const { matchId } = await req.json();

  const { data: match } = await supabase
    .from('group_listing_matches')
    .select('*, listing:listings(host_id, title, bedrooms, neighborhood, price)')
    .eq('id', matchId)
    .single();

  if (!match) return errorResponse('Match not found', 404);
  if (match.listing.host_id !== user.id) return errorResponse('Unauthorized', 403);
  if (match.unlock_status === 'unlocked') return errorResponse('Already unlocked', 400);
  if (new Date(match.expires_at) < new Date()) return errorResponse('Match expired', 410);

  if (match.unlock_fee_cents === 0) {
    await supabase
      .from('group_listing_matches')
      .update({ unlock_status: 'unlocked', unlock_paid_at: new Date().toISOString() })
      .eq('id', matchId);
    return new Response(JSON.stringify({ unlocked: true, free: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { data: hostData } = await supabase
    .from('users')
    .select('stripe_customer_id, email, full_name')
    .eq('id', user.id)
    .single();

  let customerId = hostData?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: hostData?.email,
      name: hostData?.full_name,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: match.unlock_fee_cents,
    currency: 'usd',
    customer: customerId,
    metadata: {
      type: 'group_unlock',
      match_id: matchId,
      group_id: match.group_id,
      listing_id: match.listing_id,
      host_id: user.id,
    },
    automatic_payment_methods: { enabled: true },
  });

  await supabase
    .from('group_listing_matches')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', matchId);

  return new Response(
    JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
});
