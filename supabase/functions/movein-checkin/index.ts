import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, renter_id, listing_id')
      .eq('status', 'confirmed')
      .eq('move_in_date', today)
      .is('checkin_sent_at', null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validBookings = bookings ?? [];
    let notified = 0;

    if (validBookings.length > 0) {
      const notifications = validBookings.map(booking => ({
        user_id: booking.renter_id,
        type: 'movein_checkin',
        title: 'How\'s your new apartment?',
        body: 'Hope the move went smoothly! Let us know how you\'re settling in.',
        data: JSON.stringify({
          type: 'movein_checkin',
          bookingId: booking.id,
          screen: 'MoveInCheckin',
        }),
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('[movein-checkin] Failed to send notifications:', notifError);
      }

      for (const booking of validBookings) {
        await supabase.from('bookings')
          .update({ checkin_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        notified++;
      }
    }

    return new Response(JSON.stringify({ success: true, notified }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
