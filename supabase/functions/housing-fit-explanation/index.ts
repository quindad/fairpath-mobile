// Edge Function entry for housing-fit-explanation: Signal explains, in plain language, how a listing's stated
// screening criteria lines up with a renter's own background -- same real flow as job-fit-explanation (auth ->
// spend_ai_credits -> gateway -> safety guard -> text), via the shared Signal runner.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

const WORKFLOW = WORKFLOWS.housing_criteria_explainer;
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
    .select('title,rent_monthly,deposit_amount,screening_summary,lease_terms,pet_policy,property_type')
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
      system: 'You are FairPath Signal, explaining to a renter (often with a past conviction) how a listing\'s stated screening criteria lines up with their own background, in plain, encouraging, honest language. Never state an approval decision, a score, or a guarantee. Only explain what the listing itself says versus what the renter told FairPath. Keep it under 150 words.',
      user: `Listing: ${listing.title}\nRent: $${listing.rent_monthly}/mo, deposit $${listing.deposit_amount ?? 'not listed'}\nScreening summary: ${listing.screening_summary ?? 'not specified'}\nLease terms: ${(listing.lease_terms ?? []).join(', ')}\nPet policy: ${listing.pet_policy ?? 'not specified'}\n\nRenter background: ${profile?.experience_summary ?? 'not provided'}\n\nExplain, in plain language, how this renter's background lines up with what this listing says about screening.`,
    },
  });
});
