import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

Deno.serve(async (req) => {
  const { userId } = await req.json();
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { user_id: userId },
    options: {
      document: {
        allowed_types: ['driving_license', 'passport', 'id_card'],
        require_live_capture: true,
        require_matching_selfie: true,
      },
    },
  });
  return new Response(
    JSON.stringify({
      sessionId: session.id,
      clientSecret: session.client_secret,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
