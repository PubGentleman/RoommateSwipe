import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = Date.now();
    const thirteenDaysAgo = new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveUsers, error } = await supabase
      .from('users')
      .select('id, last_active_at')
      .lt('last_active_at', thirteenDaysAgo)
      .gte('last_active_at', fourteenDaysAgo)
      .eq('role', 'renter')
      .or('is_deleted.is.null,is_deleted.eq.false');

    if (error) throw error;

    let sentCount = 0;
    for (const profile of inactiveUsers ?? []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .eq('type', 'activity_nudge')
        .gte('created_at', fourteenDaysAgo)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'activity_nudge',
        title: 'New roommate matches are waiting',
        body: "You have new people to connect with. Come see who's looking in your area.",
        data: JSON.stringify({ type: 'activity_nudge', screen: 'Explore' }),
        read: false,
      });
      sentCount++;
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
