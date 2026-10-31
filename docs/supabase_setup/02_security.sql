-- ============================================================================
-- PULSE — SUPABASE CLOUD MIGRATION: CLOUD SETUP & RLS HARDENING
-- File: server/src/db/migrations/001_cloud_setup_and_security.sql
-- Description: Applies hardened auth.users sync triggers, safe non-destructive
--              ownership constraints, repeatable RLS policies (with public read
--              for story_articles & briefing_stories), and user profile protection.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 2. HARDENED AUTH.USERS -> PUBLIC.USERS SYNCHRONIZATION TRIGGER
-- Restricted search_path, schema-qualified objects, non-privileged defaults.
-- Ordinary signup metadata is NEVER trusted for is_admin or is_guest privileges.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert profile into public.users with hardcoded non-admin defaults
  INSERT INTO public.users (
    id,
    email,
    full_name,
    is_guest,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    FALSE, -- Hardcoded non-guest (never trust client metadata)
    FALSE, -- Hardcoded non-admin (strictly non-admin)
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();

  -- Automatically seed default reading preferences for the new user
  INSERT INTO public.user_preferences (
    user_id,
    country_code,
    state,
    interface_language,
    news_reading_language,
    summary_length,
    theme,
    enable_notifications,
    quiet_hours_start,
    quiet_hours_end,
    topics_of_interest
  )
  VALUES (
    NEW.id,
    'IN',
    COALESCE(NEW.raw_user_meta_data->>'state', 'Telangana'),
    'en',
    'en',
    'balanced',
    'light',
    TRUE,
    '22:00',
    '07:00',
    '["governance", "technology", "economy", "infrastructure", "education"]'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Restrict function execution: Only Supabase Auth Admin and service_role can trigger
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin, service_role;

-- Recreate trigger idempotently on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 3. USER OWNERSHIP & INTEGRITY CONSTRAINTS (SAFE & NON-DESTRUCTIVE)
-- Apply NOT NULL and UNIQUE constraints idempotently without deleting user data.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- A. user_preferences.user_id: ensure NOT NULL and UNIQUE
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences') THEN
    -- Check for duplicate user_preferences before adding unique constraint
    IF EXISTS (
      SELECT user_id, COUNT(*) 
      FROM public.user_preferences 
      WHERE user_id IS NOT NULL 
      GROUP BY user_id 
      HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'Duplicate user_preferences found; skipping unique constraint to preserve existing data. Manual deduplication required.';
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_user_id_key'
    ) THEN
      ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);
    END IF;

    -- Apply NOT NULL if no NULL rows exist
    IF NOT EXISTS (SELECT 1 FROM public.user_preferences WHERE user_id IS NULL) THEN
      ALTER TABLE public.user_preferences ALTER COLUMN user_id SET NOT NULL;
    ELSE
      RAISE NOTICE 'NULL user_id found in user_preferences; skipping NOT NULL to preserve existing data.';
    END IF;
  END IF;

  -- B. saved_stories: ensure user_id and story_id are NOT NULL
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_stories') THEN
    IF NOT EXISTS (SELECT 1 FROM public.saved_stories WHERE user_id IS NULL OR story_id IS NULL) THEN
      ALTER TABLE public.saved_stories ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE public.saved_stories ALTER COLUMN story_id SET NOT NULL;
    END IF;
  END IF;

  -- C. reading_history: ensure user_id and story_id are NOT NULL
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reading_history') THEN
    IF NOT EXISTS (SELECT 1 FROM public.reading_history WHERE user_id IS NULL OR story_id IS NULL) THEN
      ALTER TABLE public.reading_history ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE public.reading_history ALTER COLUMN story_id SET NOT NULL;
    END IF;
  END IF;

  -- D. vocabulary_entries: ensure user_id is NOT NULL
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vocabulary_entries') THEN
    IF NOT EXISTS (SELECT 1 FROM public.vocabulary_entries WHERE user_id IS NULL) THEN
      ALTER TABLE public.vocabulary_entries ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;

  -- E. ask_conversations: ensure user_id is NOT NULL
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ask_conversations') THEN
    IF NOT EXISTS (SELECT 1 FROM public.ask_conversations WHERE user_id IS NULL) THEN
      ALTER TABLE public.ask_conversations ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;

  -- F. notification_delivery_history: ensure user_id is NOT NULL
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_delivery_history') THEN
    IF NOT EXISTS (SELECT 1 FROM public.notification_delivery_history WHERE user_id IS NULL) THEN
      ALTER TABLE public.notification_delivery_history ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Idempotent, repeatable policies with clean separation between public reading
-- and cryptographically isolated private user records.
-- ----------------------------------------------------------------------------

-- A. PUBLIC EDITORIAL NEWS READ ACCESS (SELECT only, NO public mutations)
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on news sources" ON public.news_sources;
CREATE POLICY "Public read on news sources" ON public.news_sources FOR SELECT USING (true);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on articles" ON public.articles;
CREATE POLICY "Public read on articles" ON public.articles FOR SELECT USING (true);

ALTER TABLE public.canonical_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on canonical stories" ON public.canonical_stories;
CREATE POLICY "Public read on canonical stories" ON public.canonical_stories FOR SELECT USING (true);

-- Explicit public read access for source relationships
ALTER TABLE public.story_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on story articles" ON public.story_articles;
CREATE POLICY "Public read on story articles" ON public.story_articles FOR SELECT USING (true);

ALTER TABLE public.story_timeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on story timeline" ON public.story_timeline_events;
CREATE POLICY "Public read on story timeline" ON public.story_timeline_events FOR SELECT USING (true);

ALTER TABLE public.hourly_pulse_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on briefings" ON public.hourly_pulse_briefings;
CREATE POLICY "Public read on briefings" ON public.hourly_pulse_briefings FOR SELECT USING (true);

-- Explicit public read access for stories in hourly briefings
ALTER TABLE public.briefing_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on briefing stories" ON public.briefing_stories;
CREATE POLICY "Public read on briefing stories" ON public.briefing_stories FOR SELECT USING (true);

ALTER TABLE public.perspective_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on perspectives" ON public.perspective_analyses;
CREATE POLICY "Public read on perspectives" ON public.perspective_analyses FOR SELECT USING (true);

ALTER TABLE public.cached_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on translations" ON public.cached_translations;
CREATE POLICY "Public read on translations" ON public.cached_translations FOR SELECT USING (true);

ALTER TABLE public.cached_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read on definitions" ON public.cached_definitions;
CREATE POLICY "Public read on definitions" ON public.cached_definitions FOR SELECT USING (true);

-- B. PROTECT PUBLIC.USERS: Users can read only their own profile
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- C. USER-ISOLATED DATA POLICIES (Strict cryptographic isolation: auth.uid() = user_id)
-- Shared-guest backdoor ('00000000-0000-0000-0000-000000000000') is completely removed.

-- User preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Saved stories
ALTER TABLE public.saved_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saved stories" ON public.saved_stories;
CREATE POLICY "Users manage own saved stories" ON public.saved_stories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reading history
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own reading history" ON public.reading_history;
CREATE POLICY "Users manage own reading history" ON public.reading_history
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vocabulary entries
ALTER TABLE public.vocabulary_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own vocabulary" ON public.vocabulary_entries;
CREATE POLICY "Users manage own vocabulary" ON public.vocabulary_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vocabulary reviews
ALTER TABLE public.vocabulary_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own vocabulary reviews" ON public.vocabulary_reviews;
CREATE POLICY "Users manage own vocabulary reviews" ON public.vocabulary_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vocabulary_entries ve
      WHERE ve.id = vocabulary_reviews.vocabulary_id
        AND ve.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vocabulary_entries ve
      WHERE ve.id = vocabulary_reviews.vocabulary_id
        AND ve.user_id = auth.uid()
    )
  );

-- Ask conversations
ALTER TABLE public.ask_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own conversations" ON public.ask_conversations;
CREATE POLICY "Users manage own conversations" ON public.ask_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ask messages
ALTER TABLE public.ask_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own ask messages" ON public.ask_messages;
CREATE POLICY "Users manage own ask messages" ON public.ask_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ask_conversations ac
      WHERE ac.id = ask_messages.conversation_id
        AND ac.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ask_conversations ac
      WHERE ac.id = ask_messages.conversation_id
        AND ac.user_id = auth.uid()
    )
  );

-- Notification delivery history
ALTER TABLE public.notification_delivery_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own notifications" ON public.notification_delivery_history;
CREATE POLICY "Users view own notifications" ON public.notification_delivery_history
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    failure_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

