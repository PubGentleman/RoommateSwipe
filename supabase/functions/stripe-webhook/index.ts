import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string | null;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const planType = sub.metadata?.plan_type ?? 'renter';

      if (planType === 'renter') {
        const { data: renterSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (renterSub) {
          await supabase.from('subscriptions').update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          }).eq('user_id', renterSub.user_id);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  if (
    event.type !== 'customer.subscription.created' &&
    event.type !== 'customer.subscription.updated' &&
    event.type !== 'customer.subscription.deleted'
  ) {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  const planType = subscription.metadata?.plan_type ?? 'renter';
  const planTier = subscription.metadata?.plan ?? 'free';
  const billingCycle = subscription.metadata?.billing_cycle ?? 'monthly';

  if (planType === 'renter') {
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

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      updates.status = 'active';
      updates.plan = planTier;
      updates.billing_cycle = billingCycle;
    } else if (event.type === 'customer.subscription.deleted') {
      updates.status = 'cancelled';
      updates.plan = 'free';
    }

    await supabase.from('subscriptions').update(updates).eq('user_id', sub.user_id);
  }

  if (planType === 'host') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) return new Response('Host profile not found', { status: 404 });

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      await supabase.from('profiles').update({
        host_plan: planTier,
        host_stripe_subscription_id: subscription.id,
        host_plan_billing_cycle: billingCycle,
        host_plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
    } else if (event.type === 'customer.subscription.deleted') {
      await supabase.from('profiles').update({
        host_plan: 'free',
        host_stripe_subscription_id: null,
        host_plan_expires_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
