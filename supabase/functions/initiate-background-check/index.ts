import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CHECKR_API_KEY = Deno.env.get('CHECKR_API_KEY')!;
const CHECKR_PACKAGE = 'roommate_basic';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    let userId: string;
    let email: string;

    if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error } = await supabaseAuth.auth.getUser();
      if (error || !user) {
        const body = await req.json();
        userId = body.userId;
        email = body.email;
      } else {
        userId = user.id;
        email = user.email!;
      }
    } else {
      const body = await req.json();
      userId = body.userId;
      email = body.email;
    }

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: 'User ID and email are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const candidateRes = await fetch('https://api.checkr.com/v1/candidates', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(CHECKR_API_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    const candidate = await candidateRes.json();
    if (!candidateRes.ok) throw new Error(candidate.message || 'Failed to create candidate');

    const invitationRes = await fetch('https://api.checkr.com/v1/invitations', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(CHECKR_API_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id: candidate.id,
        package: CHECKR_PACKAGE,
      }),
    });
    const invitation = await invitationRes.json();
    if (!invitationRes.ok) throw new Error(invitation.message || 'Failed to create invitation');

    await supabaseAdmin
      .from('users')
      .update({
        background_check_status: 'pending',
        checkr_candidate_id: candidate.id,
        background_check_initiated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return new Response(
      JSON.stringify({
        status: 'pending',
        invitationUrl: invitation.invitation_url,
        message: 'Background check initiated. A link has been sent to your email.',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
