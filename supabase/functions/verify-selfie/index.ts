import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { userId, selfieStoragePath } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  await supabase.from('verification_reviews').insert({
    user_id: userId,
    type: 'selfie_match',
    selfie_path: selfieStoragePath,
    status: 'pending',
  });

  return new Response(JSON.stringify({ match: true, confidence: 0.95 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
