import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function detectContactExchange(messages: any[]): { detected: boolean; type: string } {
  const phoneRegex = /(\+?1?\s?)?(\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})/g;
  const instagramRegex = /@[a-zA-Z0-9_.]{1,30}/g;
  const snapchatRegex = /snapchat[:\s]+[a-zA-Z0-9_.]{1,30}/gi;
  const whatsappRegex = /whatsapp/gi;

  const recentMessages = messages.slice(-10).map((m: any) => m.content).join(' ');

  if (phoneRegex.test(recentMessages)) return { detected: true, type: 'phone_detected' };
  if (instagramRegex.test(recentMessages)) return { detected: true, type: 'instagram_detected' };
  if (snapchatRegex.test(recentMessages)) return { detected: true, type: 'phone_detected' };
  if (whatsappRegex.test(recentMessages)) return { detected: true, type: 'phone_detected' };

  return { detected: false, type: '' };
}

async function findMidpointCoffeeShop(
  neighborhood1: string,
  neighborhood2: string,
  city: string = 'New York'
): Promise<{ name: string; address: string; mapsUrl: string; midpoint: string } | null> {
  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!googleApiKey) return null;

  const midpointQuery = `coffee shop near ${neighborhood1} ${neighborhood2} ${city}`;
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(midpointQuery)}&key=${googleApiKey}`;

  try {
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const sorted = data.results
        .filter((p: any) => p.rating >= 4.0)
        .sort((a: any, b: any) => b.rating - a.rating);

      const place = sorted[0] || data.results[0];
      const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(place.formatted_address)}`;

      return {
        name: place.name,
        address: place.formatted_address,
        mapsUrl,
        midpoint: `between ${neighborhood1} and ${neighborhood2}`,
      };
    }
  } catch (e) {
    console.error('Places API error:', e);
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { conversationId, userId1, userId2, messages } = await req.json();

    if (authUser.id !== userId1 && authUser.id !== userId2) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await supabase
      .from('meetup_suggestions')
      .select('id, status')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ alreadySuggested: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!messages || messages.length < 6) {
      return new Response(JSON.stringify({ notEnoughMessages: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contactCheck = detectContactExchange(messages);

    let shouldSuggest = contactCheck.detected;
    let triggerType = contactCheck.type;
    let confidenceScore = contactCheck.detected ? 95 : 0;

    if (!shouldSuggest) {
      const conversationText = messages
        .slice(-15)
        .map((m: any) => `${m.senderName}: ${m.content}`)
        .join('\n');

      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          system: 'You analyze roommate app conversations to determine if two people are genuinely interested in living together. Respond ONLY with a JSON object, no other text.',
          messages: [{
            role: 'user',
            content: `Analyze this conversation between two people looking for roommates.
Are they showing strong mutual interest in actually living together?

Conversation:
${conversationText}

Respond with exactly this JSON:
{
  "interestedInLivingTogether": true or false,
  "confidence": 0-100,
  "signals": ["list", "of", "signals", "you", "detected"]
}

Signals to look for: scheduling a meetup, discussing move-in dates, asking about the actual apartment, expressing excitement about compatibility, both parties being very engaged and responsive.`,
          }],
        }),
      });

      if (claudeResponse.ok) {
        const claudeData = await claudeResponse.json();
        const responseText = claudeData.content?.[0]?.type === 'text'
          ? claudeData.content[0].text
          : '';

        try {
          const analysis = JSON.parse(responseText);
          if (analysis.interestedInLivingTogether && analysis.confidence >= 75) {
            shouldSuggest = true;
            triggerType = 'ai_detected';
            confidenceScore = analysis.confidence;
          }
        } catch (e) {
          console.error('Failed to parse Claude response:', e);
        }
      }
    }

    if (!shouldSuggest) {
      return new Response(JSON.stringify({ notReadyYet: true, confidence: confidenceScore }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, neighborhood, preferred_trains')
      .in('id', [userId1, userId2]);

    const profile1 = profiles?.find((p: any) => p.id === userId1);
    const profile2 = profiles?.find((p: any) => p.id === userId2);

    const neighborhood1 = profile1?.neighborhood || 'Manhattan';
    const neighborhood2 = profile2?.neighborhood || 'Brooklyn';

    const venue = await findMidpointCoffeeShop(neighborhood1, neighborhood2);

    const { data: suggestion, error } = await supabase
      .from('meetup_suggestions')
      .insert({
        conversation_id: conversationId,
        user_id_1: userId1,
        user_id_2: userId2,
        trigger_type: triggerType,
        confidence_score: confidenceScore,
        suggested_venue_name: venue?.name || null,
        suggested_venue_address: venue?.address || null,
        suggested_venue_maps_url: venue?.mapsUrl || null,
        midpoint_neighborhood: venue?.midpoint || `between ${neighborhood1} and ${neighborhood2}`,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', [userId1, userId2]);

    if (tokens?.length) {
      const notifications = tokens.map((t: any) => {
        const otherProfile = t.user_id === userId1 ? profile2 : profile1;
        return {
          to: t.token,
          title: 'You two seem like a great match!',
          body: `Want to meet ${otherProfile?.first_name || 'your match'} for coffee? We found a spot halfway between you.`,
          data: {
            type: 'meetup_suggestion',
            conversationId,
            suggestionId: suggestion.id,
            screen: 'Chat',
          },
        };
      });

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications),
      }).catch((e: any) => console.error('Push notification error:', e));
    }

    return new Response(JSON.stringify({ success: true, suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('analyze-chat-intent error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
