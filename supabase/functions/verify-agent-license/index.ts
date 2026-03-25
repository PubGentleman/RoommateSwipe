import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STATE_LOOKUP_CONFIG: Record<string, {
  url: string;
  method: 'GET' | 'POST';
  buildParams: (license: string, firstName: string, lastName: string) => Record<string, string>;
  parseResult: (html: string, license: string, firstName: string, lastName: string) => boolean;
}> = {
  NY: {
    url: 'https://eservices.nysed.gov/professions/verification-search',
    method: 'GET',
    buildParams: (license) => ({ licenseNumber: license, professionCode: '30' }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('active');
    },
  },
  FL: {
    url: 'https://www.myfloridalicense.com/wl11.asp',
    method: 'GET',
    buildParams: (license) => ({ LicenseNumber: license, SID: 'null', bExact: 'Y' }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             (lowerHtml.includes('current,active') || lowerHtml.includes('active'));
    },
  },
  TX: {
    url: 'https://www.trec.texas.gov/apps/license-holder-search/',
    method: 'GET',
    buildParams: (license) => ({ license }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('active');
    },
  },
  CA: {
    url: 'https://www2.dre.ca.gov/PublicASP/pplinfo.asp',
    method: 'GET',
    buildParams: (license) => ({ LicnNmbr: license }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('licensed');
    },
  },
  GA: {
    url: 'https://verify.sos.ga.gov/verification/Search.aspx',
    method: 'GET',
    buildParams: (_, firstName, lastName) => ({
      LicenseNumber: '',
      FirstName: firstName,
      LastName: lastName,
      ProfessionCode: 'REC',
    }),
    parseResult: (html, _, __, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(lastName.toLowerCase()) && lowerHtml.includes('active');
    },
  },
  NC: {
    url: 'https://www.ncrec.gov/Lookup/LicenseLookup',
    method: 'GET',
    buildParams: (license) => ({ LicenseNumber: license }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('active');
    },
  },
  IL: {
    url: 'https://online-dfpr.micropact.com/lookup/licenselookup.aspx',
    method: 'GET',
    buildParams: (license) => ({ LicenseNumber: license }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('active');
    },
  },
  AZ: {
    url: 'https://www.azre.gov/Pub/VerifyLicense.aspx',
    method: 'GET',
    buildParams: (license) => ({ LicenseNumber: license }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('active');
    },
  },
  NV: {
    url: 'https://red.nv.gov/Content/Licensees/Lookup/',
    method: 'GET',
    buildParams: (license) => ({ LicenseNumber: license }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('active');
    },
  },
  CO: {
    url: 'https://apps2.colorado.gov/dre/licensing/lookup/licenselookup.aspx',
    method: 'GET',
    buildParams: (license) => ({ LicenseNumber: license }),
    parseResult: (html, license, _, lastName) => {
      const lowerHtml = html.toLowerCase();
      return lowerHtml.includes(license.toLowerCase()) &&
             lowerHtml.includes(lastName.toLowerCase()) &&
             lowerHtml.includes('active');
    },
  },
};

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ verified: false, reason: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser();
  if (authError || !authUser) {
    return new Response(JSON.stringify({ verified: false, reason: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = authUser.id;
  const { licenseNumber, licenseState, firstName, lastName } = await req.json();

  const stateConfig = STATE_LOOKUP_CONFIG[licenseState?.toUpperCase()];

  if (!stateConfig) {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    await serviceClient.from('users').update({
      license_verified: false,
      license_verification_status: 'manual_review',
    }).eq('id', userId);

    return new Response(
      JSON.stringify({ verified: false, reason: 'manual_review', message: 'State not yet supported for auto-verification' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const params = stateConfig.buildParams(licenseNumber, firstName ?? '', lastName ?? '');
    const queryString = new URLSearchParams(params).toString();
    const fetchUrl = `${stateConfig.url}?${queryString}`;

    const response = await fetch(fetchUrl, {
      method: stateConfig.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RhomeLicenseVerification/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const html = await response.text();
    const verified = stateConfig.parseResult(html, licenseNumber, firstName ?? '', lastName ?? '');

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    await serviceClient.from('users').update({
      license_verified: verified,
      license_verified_at: verified ? new Date().toISOString() : null,
      license_verification_status: verified ? 'verified' : 'manual_review',
    }).eq('id', userId);

    return new Response(
      JSON.stringify({ verified, reason: verified ? 'matched' : 'not_found' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    await serviceClient.from('users').update({
      license_verification_status: 'manual_review',
    }).eq('id', userId);

    return new Response(
      JSON.stringify({ verified: false, reason: 'manual_review', message: (err as Error).message }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
});
