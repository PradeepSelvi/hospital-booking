-- ============================================================
-- MEDIBOOK — PINCODE GEOCODE BACKFILL (more hospitals on the map)
-- Run in: Supabase SQL Editor  or  `supabase db push`
-- Version: 1.0.0
--
-- PROBLEM
--   Only ~300 of ~30,000 directory rows carry usable `Location_Coordinates`,
--   so most hospitals can't be plotted. Almost all rows DO have a 6-digit
--   pincode, however.
--
-- SOLUTION
--   Keep a `pincode_geo` cache (pincode → lat/lng centroid), populated by the
--   `geocode-pincodes` Edge Function (throttled OSM Nominatim, distinct
--   pincodes only — a few thousand calls instead of 30k). The directory views
--   then FALL BACK to the pincode centroid when a row has no coordinates of its
--   own, so every hospital with a known pincode becomes mappable. Map marker
--   clustering keeps same-pincode stacks readable.
--
-- NON-DESTRUCTIVE: adds a cache table + redefines the two read-only views.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. PINCODE → COORDINATE CACHE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pincode_geo (
    pincode     text PRIMARY KEY,
    lat         double precision,
    lng         double precision,
    -- 'ok'      = geocoded successfully
    -- 'notfound'= geocoder returned nothing (don't retry endlessly)
    status      text NOT NULL DEFAULT 'ok',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pincode_geo ENABLE ROW LEVEL SECURITY;

-- Public read (the views join this); writes happen only via the Edge Function
-- using the service-role key, which bypasses RLS.
DROP POLICY IF EXISTS "pincode_geo_public_read" ON public.pincode_geo;
CREATE POLICY "pincode_geo_public_read"
    ON public.pincode_geo FOR SELECT TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────
-- 2. GOVERNMENT-ONLY VIEW (with pincode fallback)
--    Coordinates: own parsed "lat, lng" → else pincode centroid.
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.govt_hospitals_v
WITH (security_invoker = true)
AS
SELECT
    h."Sr_No"::text                                              AS sr_no,
    public.medi_null0(h."Hospital_Name"::text)                  AS name,
    public.medi_null0(h."State"::text)                          AS state,
    public.medi_null0(h."District"::text)                       AS district,
    public.medi_null0(h."Subdistrict"::text)                    AS subdistrict,
    public.medi_null0(h."Town"::text)                           AS town,
    public.medi_null0(h."Subtown"::text)                        AS subtown,
    public.medi_null0(h."Village"::text)                        AS village,
    public.medi_null0(h."Pincode"::text)                        AS pincode,
    public.medi_null0(h."Location"::text)                       AS location,
    public.medi_null0(h."Address_Original_First_Line"::text)    AS address,
    public.medi_null0(h."Hospital_Category"::text)              AS category,
    public.medi_null0(h."Hospital_Care_Type"::text)             AS care_type,
    public.medi_null0(h."Discipline_Systems_of_Medicine"::text) AS discipline,
    public.medi_null0(h."Specialties"::text)                    AS specialties,
    public.medi_null0(h."Facilities"::text)                     AS facilities,
    public.medi_null0(h."Telephone"::text)                      AS telephone,
    public.medi_null0(h."Mobile_Number"::text)                  AS mobile,
    public.medi_null0(h."Emergency_Num"::text)                  AS emergency,
    public.medi_null0(h."Ambulance_Phone_No"::text)             AS ambulance,
    public.medi_null0(h."Website"::text)                        AS website,
    CASE WHEN regexp_replace(COALESCE(h."Total_Num_Beds"::text, ''), '\D', '', 'g') ~ '^\d{1,7}$'
         THEN NULLIF(regexp_replace(COALESCE(h."Total_Num_Beds"::text, ''), '\D', '', 'g')::int, 0) END AS total_beds,
    CASE WHEN regexp_replace(COALESCE(h."Number_Doctor"::text, ''), '\D', '', 'g') ~ '^\d{1,7}$'
         THEN NULLIF(regexp_replace(COALESCE(h."Number_Doctor"::text, ''), '\D', '', 'g')::int, 0) END AS num_doctors,
    CASE WHEN regexp_replace(COALESCE(h."Establised_Year"::text, ''), '\D', '', 'g') ~ '^\d{1,4}$'
         THEN NULLIF(regexp_replace(COALESCE(h."Establised_Year"::text, ''), '\D', '', 'g')::int, 0) END AS established_year,
    COALESCE(
        CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
             THEN btrim(split_part(h."Location_Coordinates"::text, ',', 1))::double precision END,
        pg.lat
    ) AS latitude,
    COALESCE(
        CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
             THEN btrim(split_part(h."Location_Coordinates"::text, ',', 2))::double precision END,
        pg.lng
    ) AS longitude
FROM public.hospital_dicnory h
LEFT JOIN public.pincode_geo pg
    ON pg.pincode = public.medi_null0(h."Pincode"::text) AND pg.status = 'ok'
WHERE public.medi_null0(h."Hospital_Category"::text) ILIKE '%government%';

GRANT SELECT ON public.govt_hospitals_v TO anon, authenticated;

-- ─────────────────────────────────────────────
-- 3. COMPLETE DIRECTORY VIEW (with pincode fallback)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.all_hospitals_v
WITH (security_invoker = true)
AS
SELECT
    h."Sr_No"::text                                              AS sr_no,
    public.medi_null0(h."Hospital_Name"::text)                  AS name,
    public.medi_null0(h."State"::text)                          AS state,
    public.medi_null0(h."District"::text)                       AS district,
    public.medi_null0(h."Town"::text)                           AS town,
    public.medi_null0(h."Pincode"::text)                        AS pincode,
    public.medi_null0(h."Address_Original_First_Line"::text)    AS address,
    public.medi_null0(h."Hospital_Category"::text)              AS category,
    public.medi_null0(h."Hospital_Care_Type"::text)             AS care_type,
    public.medi_null0(h."Discipline_Systems_of_Medicine"::text) AS discipline,
    public.medi_null0(h."Specialties"::text)                    AS specialties,
    public.medi_null0(h."Facilities"::text)                     AS facilities,
    public.medi_null0(h."Telephone"::text)                      AS telephone,
    public.medi_null0(h."Mobile_Number"::text)                  AS mobile,
    public.medi_null0(h."Website"::text)                        AS website,
    CASE WHEN regexp_replace(COALESCE(h."Total_Num_Beds"::text, ''), '\D', '', 'g') ~ '^\d{1,7}$'
         THEN NULLIF(regexp_replace(COALESCE(h."Total_Num_Beds"::text, ''), '\D', '', 'g')::int, 0) END AS total_beds,
    COALESCE(
        CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
             THEN btrim(split_part(h."Location_Coordinates"::text, ',', 1))::double precision END,
        pg.lat
    ) AS latitude,
    COALESCE(
        CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
             THEN btrim(split_part(h."Location_Coordinates"::text, ',', 2))::double precision END,
        pg.lng
    ) AS longitude
FROM public.hospital_dicnory h
LEFT JOIN public.pincode_geo pg
    ON pg.pincode = public.medi_null0(h."Pincode"::text) AND pg.status = 'ok';

GRANT SELECT ON public.all_hospitals_v TO anon, authenticated;

-- ─────────────────────────────────────────────
-- 4. HELPER RPC — distinct pincodes still needing geocoding
--    Used by the geocode-pincodes Edge Function to pick its next batch.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pincodes_needing_geocode(p_limit int DEFAULT 40)
RETURNS TABLE (pincode text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT public.medi_null0(h."Pincode"::text) AS pincode
    FROM public.hospital_dicnory h
    WHERE public.medi_null0(h."Pincode"::text) ~ '^\d{6}$'
      AND NOT EXISTS (
          SELECT 1 FROM public.pincode_geo g
          WHERE g.pincode = public.medi_null0(h."Pincode"::text)
      )
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.pincodes_needing_geocode(int) FROM anon, authenticated;
-- Only the service role (Edge Function) needs this.
