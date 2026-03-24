import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function findProfileByCustomer(customerId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('stripe_customer_id', customerId)
    .single();
  return profile;
}

async function updateSubscription(userId: string, customerId: string, updates: Record<string, any>) {
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

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

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const piMetadata = paymentIntent.metadata;

    if (piMetadata.type === 'group_unlock') {
      await supabase
        .from('group_listing_matches')
        .update({
          unlock_status: 'unlocked',
          unlock_paid_at: new Date().toISOString(),
        })
        .eq('id', piMetadata.match_id);

      const { data: match } = await supabase
        .from('group_listing_matches')
        .select('group_id, listing:listings(title, neighborhood)')
        .eq('id', piMetadata.match_id)
        .single();

      if (match) {
        const { data: groupMembers } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', match.group_id);

        for (const member of (groupMembers ?? [])) {
          await supabase.from('notifications').insert({
            user_id: member.user_id,
            type: 'host_interest',
            title: 'A host is interested in your group!',
            body: `A host with a listing in ${(match as any).listing?.neighborhood ?? 'your area'} wants to connect with your group.`,
            data: JSON.stringify({
              group_id: match.group_id,
              listing_id: piMetadata.listing_id,
            }),
          });
        }
      }
    }

    if (piMetadata.type === 'placement_fee') {
      await supabase
        .from('agent_placements')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', piMetadata.placement_id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    const profile = await findProfileByCustomer(customerId);
    if (profile) {
      await supabase
        .from('subscriptions')
        .update({ free_group_unlocks_used: 0 })
        .eq('user_id', profile.id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const paidCustomerId = invoice.customer as string;

    const profile = await findProfileByCustomer(paidCustomerId);
    if (profile) {
      await supabase
        .from('subscriptions')
        .update({ free_group_unlocks_used: 0 })
        .eq('user_id', profile.id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string | null;

    const profile = await findProfileByCustomer(customerId);
    if (!profile) {
      console.error('No profile found for customer:', customerId);
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    if (subscriptionId) {
      await updateSubscription(profile.id, customerId, {
        stripe_subscription_id: subscriptionId,
        status: 'past_due',
      });

      await supabase
        .from('profiles')
        .update({ is_premium: false })
        .eq('id', profile.id);
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

  const profile = await findProfileByCustomer(customerId);
  if (!profile) {
    console.error('No profile found for customer:', customerId);
    return new Response('User not found', { status: 404 });
  }

  if (planType === 'renter') {
    const updates: Record<string, any> = {
      stripe_subscription_id: subscription.id,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
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

    await updateSubscription(profile.id, customerId, updates);

    await supabase
      .from('profiles')
      .update({
        is_premium: event.type !== 'customer.subscription.deleted',
        plan: event.type === 'customer.subscription.deleted' ? 'free' : planTier,
      })
      .eq('id', profile.id);
  }

  if (planType === 'host') {
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      await supabase.from('profiles').update({
        host_plan: planTier,
        host_stripe_subscription_id: subscription.id,
        host_plan_billing_cycle: billingCycle,
        host_plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        is_premium: true,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
    } else if (event.type === 'customer.subscription.deleted') {
      await supabase.from('profiles').update({
        host_plan: 'free',
        host_stripe_subscription_id: null,
        host_plan_expires_at: null,
        is_premium: false,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
