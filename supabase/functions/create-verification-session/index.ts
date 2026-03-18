import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    let userId: string;

    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        const body = await req.json();
        userId = body.userId;
      } else {
        userId = user.id;
      }
    } else {
      const body = await req.json();
      userId = body.userId;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
        url: session.url,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create verification session' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
