import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

Deno.serve(async (req) => {
  const { priceId, customerId } = await req.json();
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });
  const invoice = subscription.latest_invoice as any;
  const paymentIntent = invoice.payment_intent as any;
  return new Response(
    JSON.stringify({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
