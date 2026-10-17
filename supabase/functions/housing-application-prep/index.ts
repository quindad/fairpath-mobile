// Edge Function entry for housing-application-prep: Signal helps a member prepare for a housing application --
// what the listing's screening likely asks for, and what to have ready -- grounded only in the real listing.
// Same real flow: auth -> spend_ai_credits -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

const WORKFLOW = WORKFLOWS.renter_preparation;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { listing_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  if (!body.listing_id) return json(400, { error: 'missing_listing_id' });

  const { data: listing, error: listingError } = await userClient
    .from('housing_listings')
    .select('title,rent_monthly,deposit_amount,application_fee,screening_summary,lease_terms,pet_policy,property_type')
    .eq('id', body.listing_id)
    .maybeSingle();
  if (listingError || !listing) return json(404, { error: 'listing_not_found' });

  const { data: profile } = await userClient.from('profiles').select('experience_summary').maybeSingle();

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, helping a renter (often with a past conviction) prepare for a housing application. Based ONLY on the listing\'s stated screening info given to you, list what documents or information they will likely need to have ready (proof of income, ID, references, etc. -- generic and standard, never invented specifics about this property beyond what is given), and brief, practical tips for how to honestly address a criminal record on a rental application if asked. Never guarantee approval or state a decision. Keep it under 200 words, as a simple list.',
      user: `Listing: ${listing.title}\nRent: $${listing.rent_monthly}/mo, deposit $${listing.deposit_amount ?? 'not listed'}, application fee $${listing.application_fee ?? 'not listed'}\nScreening summary: ${listing.screening_summary ?? 'not specified'}\nLease terms: ${(listing.lease_terms ?? []).join(', ')}\n\nApplicant background: ${profile?.experience_summary ?? 'not provided'}\n\nWhat should they prepare?`,
    },
  });
});
