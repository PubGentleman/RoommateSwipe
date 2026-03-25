import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ verified: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser();
  if (authError || !authUser) {
    return new Response(JSON.stringify({ verified: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = authUser.id;
  const { licenseNumber, licenseState, firstName, lastName } = await req.json();

  try {
    const arelloResponse = await fetch(
      `https://api.arello.com/licensee/lookup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('ARELLO_API_KEY')}`,
        },
        body: JSON.stringify({
          licenseNumber,
          state: licenseState,
          firstName,
          lastName,
        }),
      }
    );

    const data = await arelloResponse.json();

    const isVerified = data.status === 'active' &&
      data.licenseNumber === licenseNumber &&
      data.state === licenseState;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    await serviceClient.from('users').update({
      license_verified: isVerified,
      license_verified_at: isVerified ? new Date().toISOString() : null,
      license_verification_status: isVerified ? 'verified' : 'manual_review',
    }).eq('id', userId);

    return new Response(JSON.stringify({ verified: isVerified }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ verified: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
