-- ============================================================
-- MEDIBOOK — COMPLETE HOSPITAL DIRECTORY VIEW ("Other hospitals")
-- Run in: Supabase SQL Editor  or  `supabase db push`
-- Version: 1.0.0
--
-- CONTEXT
--   Migration 037 restricted `govt_hospitals_v` to GOVERNMENT hospitals only
--   (for the "Hospital Search" page). The "Find & Rate Hospitals" page has an
--   "Other hospitals" toggle that should plot the ENTIRE directory
--   (government + private + uncategorised) on the map.
--
--   This view exposes the full, UNFILTERED directory in the same normalised
--   shape as `govt_hospitals_v`, plus the raw category so the UI can style /
--   label each pin (Government / Private / Other).
--
--   NOTE: only rows with parseable "lat, lng" coordinates can be mapped
--   (~a few hundred of the ~30k rows have them). The frontend requests only
--   rows where latitude IS NOT NULL.
--
-- NON-DESTRUCTIVE: read-only view over the existing table.
-- ============================================================

CREATE OR REPLACE VIEW public.all_hospitals_v
WITH (security_invoker = true)
AS
SELECT
    h."Sr_No"::text                                              AS sr_no,
    public.medi_null0(h."Hospital_Name"::text)                  AS name,
    public.medi_null0(h."State"::text)                          AS state,
    public.medi_null0(h."District"::text)                       AS district,
    public.medi_null0(h."Subdistrict"::text)                    AS subdistrict,
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
    CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
         THEN btrim(split_part(h."Location_Coordinates"::text, ',', 1))::double precision END AS latitude,
    CASE WHEN btrim(COALESCE(h."Location_Coordinates"::text, '')) ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$'
         THEN btrim(split_part(h."Location_Coordinates"::text, ',', 2))::double precision END AS longitude
FROM public.hospital_dicnory h;

GRANT SELECT ON public.all_hospitals_v TO anon, authenticated;
