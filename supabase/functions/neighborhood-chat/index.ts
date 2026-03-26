import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildFallbackAnswer(question: string, neighborhood: string, city: string): string {
  const q = question.toLowerCase();
  const loc = neighborhood || city || 'this area';

  if (q.includes('safe') || q.includes('crime') || q.includes('night')) {
    return `${loc} is a mixed neighborhood like most urban areas. It's generally advisable to stay aware of your surroundings, especially late at night. Check local crime maps and talk to current residents for the most up-to-date picture.`;
  }
  if (q.includes('commute') || q.includes('transit') || q.includes('train') || q.includes('bus') || q.includes('subway')) {
    return `${loc} has public transit options that connect to the broader ${city} network. Check Google Maps or a transit app for specific route times from the listing address to your workplace for the most accurate commute estimate.`;
  }
  if (q.includes('nightlife') || q.includes('bar') || q.includes('restaurant') || q.includes('food') || q.includes('eat')) {
    return `${loc} has a variety of dining and nightlife options within walking distance or a short ride. Explore Google Maps or Yelp for the latest restaurant ratings and hours in the area.`;
  }
  if (q.includes('family') || q.includes('kid') || q.includes('school') || q.includes('child')) {
    return `${loc} has nearby schools and parks that families use. Check GreatSchools.org for school ratings and visit the neighborhood on a weekend to get a feel for the family-friendliness.`;
  }
  if (q.includes('grocery') || q.includes('shop') || q.includes('store')) {
    return `${loc} has grocery stores and shops accessible by foot or short drive. Use Google Maps to search for supermarkets near the listing address for the closest options.`;
  }
  if (q.includes('park') || q.includes('outdoor') || q.includes('green')) {
    return `${loc} has green spaces and parks within the surrounding area. Check Google Maps for the nearest parks and trails to the listing address.`;
  }
  if (q.includes('noise') || q.includes('quiet') || q.includes('loud')) {
    return `Noise levels in ${loc} vary by block and time of day. Visit the area during different hours to get a realistic sense. Street-facing units tend to be louder than courtyard-facing ones.`;
  }
  if (q.includes('parking') || q.includes('car') || q.includes('drive')) {
    return `Parking availability in ${loc} depends on the specific block. Many ${city} neighborhoods have a mix of street parking and garage options. Check with the landlord about dedicated spots.`;
  }

  return `${loc} is an established neighborhood in ${city} with a range of amenities and transit options nearby. For specific details, I'd recommend visiting the area and exploring on foot to get the best sense of day-to-day life there.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { question, neighborhood, city, listingId, conversationHistory } = await req.json();

    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({
        reply: 'Could you rephrase your question? I want to make sure I give you accurate info.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let listingContext = '';
    let neighborhoodName = neighborhood || '';
    let cityName = city || '';

    if (listingId) {
      const { data: listing } = await supabase
        .from('listings')
        .select('address, city, state, zip, neighborhood, rent, bedrooms, bathrooms, title')
        .eq('id', listingId)
        .single();

      if (listing) {
        neighborhoodName = neighborhoodName || listing.neighborhood || listing.city || '';
        cityName = cityName || listing.city || '';
        listingContext = `
LISTING: ${listing.title || `${listing.address}, ${listing.city}`}
Address: ${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}
Neighborhood: ${neighborhoodName}
Rent: $${listing.rent}/mo | ${listing.bedrooms}bd/${listing.bathrooms}ba`.trim();
      }
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      const fallback = buildFallbackAnswer(question, neighborhoodName, cityName);
      return new Response(JSON.stringify({ reply: fallback }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const anthropic = new Anthropic({ apiKey });

      const systemPrompt = `You are Rhome AI, a helpful neighborhood advisor for renters.

${listingContext}

You are answering questions about ${neighborhoodName || 'this neighborhood'}${cityName ? ` in ${cityName}` : ''}.

RULES:
- Give honest, practical answers in 2-3 sentences
- Be specific to the neighborhood when possible
- Don't sensationalize or sugarcoat
- If you're unsure about specific details, say so honestly and suggest how the renter can find out
- Never say "I don't know" without offering a helpful alternative or suggestion
- Keep it conversational and concise`;

      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...(conversationHistory || []),
        { role: 'user', content: question },
      ];

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages,
      });

      const reply = response.content[0].type === 'text' ? response.content[0].text : '';

      if (!reply) {
        const fallback = buildFallbackAnswer(question, neighborhoodName, cityName);
        return new Response(JSON.stringify({ reply: fallback }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (claudeError) {
      console.error('Claude API error in neighborhood-chat:', claudeError);
      const fallback = buildFallbackAnswer(question, neighborhoodName, cityName);
      return new Response(JSON.stringify({ reply: fallback }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('neighborhood-chat error:', error);
    return new Response(JSON.stringify({
      reply: 'I couldn\'t look that up right now, but you can check Google Maps or local forums for neighborhood-specific info.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
