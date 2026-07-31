// supabase/functions/geocode-pincodes/index.ts
//
// PINCODE GEOCODE BACKFILL WORKER
//
// Populates public.pincode_geo (pincode -> lat/lng) so the hospital directory
// views (govt_hospitals_v / all_hospitals_v) can plot every hospital that has
// a known 6-digit pincode, even when its own Location_Coordinates are missing.
//
// How it works:
//   1. Calls RPC `pincodes_needing_geocode(p_limit)` for the next batch of
//      distinct, not-yet-cached pincodes.
//   2. Geocodes each via OSM Nominatim, THROTTLED to ~1 request/second to
//      respect the public usage policy.
//   3. Upserts results into pincode_geo (status 'ok' or 'notfound' so we never
//      retry a dead pincode).
//
// Run it repeatedly until it reports remaining = 0 (there are only a few
// thousand distinct pincodes, so a handful of invocations covers the dataset).
// Invoke on a schedule (Supabase cron) or manually:
//   supabase functions deploy geocode-pincodes --no-verify-jwt
//   curl -X POST "$URL/functions/v1/geocode-pincodes" \
//        -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
//        -d '{"batch": 40}'
//
// Deploy with --no-verify-jwt (it authenticates itself with the service-role
// key and is meant to be called by cron / an operator, not end users).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const THROTTLE_MS = 1100 // ~1 req/sec per Nominatim usage policy
const MAX_BATCH = 50

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function geocodePincode(pin: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    postalcode: pin, country: 'India', format: 'json', limit: '1',
  })
  try {
    const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'MediBook/1.0 (hospital directory backfill)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const rows = await res.json()
    const hit = rows?.[0]
    if (!hit) return null
    const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  } catch {
    return null
  }
}

serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    })

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  let batch = 40
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.batch === 'number') batch = Math.min(Math.max(body.batch, 1), MAX_BATCH)
  } catch { /* use default */ }

  // 1. Next batch of distinct pincodes needing geocoding.
  const { data: todo, error: rpcErr } = await supabase
    .rpc('pincodes_needing_geocode', { p_limit: batch })
  if (rpcErr) return json({ error: rpcErr.message }, 500)

  const pincodes: string[] = (todo ?? []).map((r: { pincode: string }) => r.pincode).filter(Boolean)
  if (pincodes.length === 0) return json({ processed: 0, remaining: 0, done: true })

  // 2. Geocode each, throttled, and 3. upsert the result.
  let ok = 0, notfound = 0
  for (const pin of pincodes) {
    const hit = await geocodePincode(pin)
    const row = hit
      ? { pincode: pin, lat: hit.lat, lng: hit.lng, status: 'ok', updated_at: new Date().toISOString() }
      : { pincode: pin, lat: null, lng: null, status: 'notfound', updated_at: new Date().toISOString() }
    const { error: upErr } = await supabase.from('pincode_geo').upsert(row, { onConflict: 'pincode' })
    if (!upErr) hit ? ok++ : notfound++
    await sleep(THROTTLE_MS)
  }

  return json({
    processed: pincodes.length,
    geocoded: ok,
    notFound: notfound,
    // If we filled a full batch there are probably more pincodes left.
    likelyMore: pincodes.length === batch,
  })
})
