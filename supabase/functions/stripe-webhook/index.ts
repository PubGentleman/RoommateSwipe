import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch {
    return new Response('Webhook signature invalid', { status: 400 });
  }

  if (event.type === 'identity.verification_session.verified') {
    const session = event.data.object as any;
    await supabase.from('users')
      .update({
        identity_verified: true,
        identity_verified_at: new Date().toISOString(),
      })
      .eq('id', session.metadata.user_id);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!sub) return new Response('User not found', { status: 404 });

  const updates: Record<string, any> = {
    stripe_subscription_id: subscription.id,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    updates.status = 'active';
    updates.plan = subscription.metadata.plan ?? 'basic';
    updates.billing_cycle = subscription.metadata.billing_cycle ?? 'monthly';
  } else if (event.type === 'customer.subscription.deleted') {
    updates.status = 'cancelled';
    updates.plan = 'basic';
  } else if (event.type === 'invoice.payment_failed') {
    updates.status = 'past_due';
  }

  await supabase.from('subscriptions').update(updates).eq('user_id', sub.user_id);

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
