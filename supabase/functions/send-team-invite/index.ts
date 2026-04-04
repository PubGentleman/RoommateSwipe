import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { teamMemberId } = await req.json();
    if (!teamMemberId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing teamMemberId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', teamMemberId)
      .single();

    if (memberError || !member) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invite not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (member.company_user_id !== caller.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not authorized for this team' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (member.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, message: 'Invite is not pending' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: companyUser } = await supabase
      .from('users')
      .select('full_name, company_name')
      .eq('id', caller.id)
      .single();

    const companyName = companyUser?.company_name || companyUser?.full_name || 'Your Company';
    const inviterName = companyUser?.full_name || 'Team Owner';
    const email = member.email;
    const role = member.role;

    const joinLink = `https://rhomeapp.io/join-team/${teamMemberId}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a1a2e; font-size: 28px; margin: 0;">Rhome</h1>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0;">by Always Rhome Inc.</p>
        </div>
        <div style="background: #f9fafb; border-radius: 16px; padding: 32px; text-align: center;">
          <h2 style="color: #1a1a2e; font-size: 22px; margin: 0 0 12px;">You're Invited!</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
            <strong>${inviterName}</strong> has invited you to join
            <strong>${companyName}</strong> on Rhome as ${role === 'admin' ? 'an Admin' : role === 'agent' ? 'an Agent' : 'a Member'}.
          </p>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px;">
            ${role === 'admin'
              ? 'As an <strong>Admin</strong>, you can manage listings, respond to inquiries, and invite new team members.'
              : role === 'agent'
                ? 'As an <strong>Agent</strong>, you\'ll get your own profile under ' + companyName + ', can be assigned to listings, and connect directly with renters.'
                : 'As a <strong>Member</strong>, you can manage listings and respond to inquiries.'}
          </p>
          <a href="${joinLink}" style="display: inline-block; background: linear-gradient(135deg, #ff6b5b, #e83a2a); color: white; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Join Team
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0;">
            If you didn't expect this invite, you can safely ignore this email.
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 24px 0 0;">
          Always Rhome Inc. &middot; hello@rhomeapp.io
        </p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY') || ''}`,
      },
      body: JSON.stringify({
        from: 'Rhome <noreply@rhomeapp.io>',
        to: email,
        subject: role === 'agent'
          ? `${inviterName} invited you to join ${companyName} as an agent on Rhome`
          : `${inviterName} invited you to join ${companyName} on Rhome`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Email send failed:', errText);
      return new Response(
        JSON.stringify({ success: true, message: 'Invite saved. Email delivery pending.' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Invite email sent to ${email}` }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-team-invite error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
