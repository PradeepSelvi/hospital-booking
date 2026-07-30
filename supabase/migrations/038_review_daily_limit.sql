-- ============================================================
-- MEDIBOOK — DAILY HOSPITAL-REVIEW LIMIT (ANTI-SPAM)
-- Run in: Supabase SQL Editor (after 030_place_reviews.sql)  or `supabase db push`
-- Version: 1.0.0
--
-- POLICY
--   Reviews stay OPEN to any signed-in user (no verified-visit requirement),
--   but a single user may create at most 20 NEW hospital reviews within a
--   rolling 24-hour window. This throttles review spam / ranking manipulation
--   while keeping the feature open.
--
--   • Applies to both MediBook ('db:') and external ('osm:') places.
--   • EDITS to a review the user already left (same user_id + place_key) are
--     ALWAYS allowed and never count against the limit — so users can revise
--     their existing opinions even after hitting the cap.
--   • Enforced server-side via a BEFORE INSERT trigger, so the limit cannot be
--     bypassed by calling the API directly.
--
-- NON-DESTRUCTIVE: does not modify or delete any existing rows.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_review_daily_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER               -- count the user's rows regardless of RLS
SET search_path = public
AS $$
DECLARE
    v_count int;
    v_limit constant int := 20;   -- max NEW reviews per user per 24h
BEGIN
    -- An edit of an existing review (same user + place) is always permitted
    -- and does not consume quota. On upsert this row already exists, so the
    -- ON CONFLICT path will UPDATE it rather than insert a new one.
    IF EXISTS (
        SELECT 1 FROM public.hospital_reviews
        WHERE user_id = NEW.user_id
          AND place_key = NEW.place_key
    ) THEN
        RETURN NEW;
    END IF;

    -- New review: how many has this user created in the last 24 hours?
    SELECT count(*) INTO v_count
    FROM public.hospital_reviews
    WHERE user_id = NEW.user_id
      AND created_at >= now() - interval '24 hours';

    IF v_count >= v_limit THEN
        RAISE EXCEPTION
            'Daily review limit reached: you can review up to % hospitals per day. Please try again later.',
            v_limit
        USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_daily_limit ON public.hospital_reviews;
CREATE TRIGGER trg_review_daily_limit
    BEFORE INSERT ON public.hospital_reviews
    FOR EACH ROW EXECUTE FUNCTION public.enforce_review_daily_limit();

-- ============================================================
-- DONE! Each user can post up to 20 new hospital reviews per day. 🛡️
-- ============================================================
