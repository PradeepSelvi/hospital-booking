-- ============================================================
-- MEDIBOOK — RESTRICT HOSPITAL DIRECTORY TO GOVERNMENT HOSPITALS
-- Run in: Supabase SQL Editor (or `supabase db push`)
-- Version: 1.0.0
--
-- CONTEXT
--   The `hospital_dicnory` table is actually a MIXED national hospital
--   directory, not a government-only one. Across 30,273 rows the
--   `Hospital_Category` column contains:
--       • "Public/ Government"  →   594 rows
--       • "Private"             → 1,446 rows
--       • (blank / "0")         → 28,233 rows  (uncategorized — sampling shows
--                                   these are largely private chains such as
--                                   Apollo, KIMS, Care, Yashoda, etc.)
--
--   The "Hospital Search" feature is meant to surface GOVERNMENT hospitals
--   only, but the `govt_hospitals_v` view (migration 036) exposed every row,
--   so private and uncategorized hospitals leaked into the results.
--
-- FIX
--   Redefine `govt_hospitals_v` so it only includes rows explicitly labelled
--   "Public/ Government". Because every search RPC (search_govt_hospitals,
--   govt_hospitals_near, govt_hospital_filter_options, govt_hospital_districts)
--   and the detail lookup read from this view, this single change makes the
--   entire feature government-only and internally consistent (counts, filters,
--   map markers all agree).
--
--   The only reliable government signal in the source data is the exact
--   category string. Uncategorized rows are intentionally EXCLUDED because
--   they cannot be distinguished from private facilities.
--
-- NON-DESTRUCTIVE: does not modify any base-table rows.
-- ============================================================

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
    CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
         THEN btrim(split_part(h."Location_Coordinates"::text, ',', 1))::double precision END AS latitude,
    CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
         THEN btrim(split_part(h."Location_Coordinates"::text, ',', 2))::double precision END AS longitude
FROM public.hospital_dicnory h
-- ── GOVERNMENT-ONLY FILTER ──
-- Keep only rows explicitly categorised as government. This is the sole
-- reliable public/government signal in the source data. Matched case-insensitively
-- on "government" to tolerate casing/spacing variants (e.g. "Public/ Government");
-- verified to return exactly the 594 government rows and exclude Private +
-- uncategorised rows.
WHERE public.medi_null0(h."Hospital_Category"::text) ILIKE '%government%';

GRANT SELECT ON public.govt_hospitals_v TO anon, authenticated;
