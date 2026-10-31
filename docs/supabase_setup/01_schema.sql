-- ============================================================================
-- PULSE — RELATIONAL DATABASE SCHEMA (POSTGRESQL / SUPABASE MIGRATION)
-- Version: 1.0.0
-- Tagline: The world, understood.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 1. USERS & PREFERENCES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    full_name TEXT,
    is_guest BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_code VARCHAR(10) DEFAULT 'IN',
    state VARCHAR(100) DEFAULT 'Telangana',
    city VARCHAR(100),
    interface_language VARCHAR(20) DEFAULT 'en',
    news_reading_language VARCHAR(20) DEFAULT 'en',
    summary_length VARCHAR(20) DEFAULT 'balanced', -- concise, balanced, detailed
    theme VARCHAR(20) DEFAULT 'light',            -- light, dark, system
    enable_notifications BOOLEAN DEFAULT TRUE,
    quiet_hours_start VARCHAR(10) DEFAULT '22:00',
    quiet_hours_end VARCHAR(10) DEFAULT '07:00',
    topics_of_interest JSONB DEFAULT '["governance", "technology", "economy", "education"]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_preferences_user_id_key UNIQUE (user_id)
);

-- ----------------------------------------------------------------------------
-- 2. NEWS SOURCES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    rss_url TEXT,
    geographic_scope VARCHAR(50) DEFAULT 'national', -- state, national, international
    country VARCHAR(10) DEFAULT 'IN',
    state VARCHAR(100),
    category VARCHAR(100) DEFAULT 'general',
    is_enabled BOOLEAN DEFAULT TRUE,
    is_official BOOLEAN DEFAULT FALSE,
    trust_tier VARCHAR(50) DEFAULT 'verified_media', -- official_govt, verified_media, academic, wire_agency
    last_fetched_at TIMESTAMPTZ,
    last_error TEXT,
    fetch_frequency_minutes INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. ARTICLES (Raw Ingested Records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES news_sources(id) ON DELETE SET NULL,
    external_id TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    url TEXT NOT NULL,
    author TEXT,
    lead_image_url TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    geographic_scope VARCHAR(50) DEFAULT 'national', -- state, national, international
    country VARCHAR(10) DEFAULT 'IN',
    state VARCHAR(100),
    category VARCHAR(100) DEFAULT 'general',
    language VARCHAR(10) DEFAULT 'en',
    evidence_label VARCHAR(100) DEFAULT 'reported_by_source',
    is_opinion BOOLEAN DEFAULT FALSE,
    is_live_ingested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_scope_state ON articles(geographic_scope, state);

-- ----------------------------------------------------------------------------
-- 4. CANONICAL STORIES (Clustered & Deduplicated Developments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canonical_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    general_take TEXT,
    geographic_scope VARCHAR(50) DEFAULT 'national',
    country VARCHAR(10) DEFAULT 'IN',
    state VARCHAR(100),
    category VARCHAR(100) DEFAULT 'general',
    lead_image_url TEXT,
    evidence_status VARCHAR(100) DEFAULT 'corroborated_by_sources',
    -- 'official_documentation', 'corroborated_by_sources', 'reported_by_one_source', 'developing_unverified', 'conflicting_reports'
    importance_level VARCHAR(20) DEFAULT 'high', -- critical, high, normal, low
    first_reported_at TIMESTAMPTZ NOT NULL,
    last_updated_at TIMESTAMPTZ NOT NULL,
    india_implication TEXT,
    is_perspective_available BOOLEAN DEFAULT TRUE,
    is_live_ingested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canonical_stories_updated ON canonical_stories(last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_stories_scope ON canonical_stories(geographic_scope, state);

-- ----------------------------------------------------------------------------
-- 5. STORY-ARTICLE RELATIONSHIPS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS story_articles (
    story_id UUID REFERENCES canonical_stories(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    is_primary_source BOOLEAN DEFAULT FALSE,
    relevance_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (story_id, article_id)
);

-- ----------------------------------------------------------------------------
-- 6. STORY TIMELINE EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS story_timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID REFERENCES canonical_stories(id) ON DELETE CASCADE,
    event_timestamp TIMESTAMPTZ NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    what_changed TEXT,
    source_name VARCHAR(255),
    source_url TEXT,
    evidence_status VARCHAR(100) DEFAULT 'corroborated_by_sources',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_story ON story_timeline_events(story_id, event_timestamp ASC);

-- ----------------------------------------------------------------------------
-- 7. HOURLY PULSE BRIEFINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hourly_pulse_briefings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_window_start TIMESTAMPTZ NOT NULL,
    time_window_end TIMESTAMPTZ NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    scope VARCHAR(50) DEFAULT 'global', -- global, national, state, international
    state VARCHAR(100),
    data_freshness_minutes INT DEFAULT 5,
    summary_overview TEXT NOT NULL,
    important_developments JSONB NOT NULL,
    what_changed_since_previous JSONB,
    source_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS briefing_stories (
    briefing_id UUID REFERENCES hourly_pulse_briefings(id) ON DELETE CASCADE,
    story_id UUID REFERENCES canonical_stories(id) ON DELETE CASCADE,
    order_index INT DEFAULT 0,
    PRIMARY KEY (briefing_id, story_id)
);

-- ----------------------------------------------------------------------------
-- 8. PERSPECTIVE DESK ANALYSES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perspective_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID REFERENCES canonical_stories(id) ON DELETE CASCADE UNIQUE,
    what_happened TEXT NOT NULL,
    general_take TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    perspectives_in_favor JSONB DEFAULT '[]',
    perspectives_against JSONB DEFAULT '[]',
    affected_groups_concerns JSONB DEFAULT '[]',
    expert_institutional_views JSONB DEFAULT '[]',
    evidence_well_established JSONB DEFAULT '[]',
    evidence_preliminary JSONB DEFAULT '[]',
    evidence_disputed JSONB DEFAULT '[]',
    evidence_missing JSONB DEFAULT '[]',
    possible_consequences_positive JSONB DEFAULT '[]',
    possible_consequences_negative JSONB DEFAULT '[]',
    what_to_watch_next JSONB DEFAULT '[]',
    perspective_comparison JSONB DEFAULT '[]',
    ai_provider VARCHAR(50) DEFAULT 'pulse-orchestrator',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. USER INTERACTIONS: SAVED STORIES & READING HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
    personal_notes TEXT,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, story_id)
);

CREATE TABLE IF NOT EXISTS reading_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    time_spent_seconds INT DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 10. ASK THE NEWS CONVERSATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ask_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Inquiry',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ask_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ask_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    cited_sources JSONB DEFAULT '[]',
    model_used VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. PERSONAL VOCABULARY & RECALL PRACTICE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vocabulary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id UUID REFERENCES canonical_stories(id) ON DELETE SET NULL,
    word VARCHAR(100) NOT NULL,
    source_sentence TEXT NOT NULL,
    original_language VARCHAR(10) DEFAULT 'en',
    target_language VARCHAR(10) DEFAULT 'en',
    contextual_meaning TEXT NOT NULL,
    original_definition TEXT,
    pronunciation VARCHAR(100),
    part_of_speech VARCHAR(50),
    example_sentence TEXT,
    synonyms JSONB DEFAULT '[]',
    personal_notes TEXT,
    mastery_level INT DEFAULT 0, -- 0: new, 1: practicing, 2: learned
    last_reviewed_at TIMESTAMPTZ,
    next_review_due TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocabulary_entries(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vocabulary_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vocabulary_id UUID REFERENCES vocabulary_entries(id) ON DELETE CASCADE,
    reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    recalled_successfully BOOLEAN NOT NULL,
    review_mode VARCHAR(50) DEFAULT 'recall_quiz'
);

-- ----------------------------------------------------------------------------
-- 12. VERSIONED CACHING (TRANSLATION & DEFINITIONS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cached_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash VARCHAR(64) NOT NULL,
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    translated_title TEXT,
    translated_summary TEXT,
    translated_content TEXT,
    translated_why_it_matters TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_hash, source_language, target_language)
);

CREATE TABLE IF NOT EXISTS cached_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word VARCHAR(100) NOT NULL,
    context_sentence_hash VARCHAR(64) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    definition_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(word, context_sentence_hash, target_language)
);

-- ----------------------------------------------------------------------------
-- 13. QUIET NOTIFICATION ENGINE RECORDS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_delivery_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id UUID REFERENCES canonical_stories(id) ON DELETE SET NULL,
    dedup_key VARCHAR(128) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', -- critical, high, normal, low
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    is_digest BOOLEAN DEFAULT FALSE,
    bundled_story_ids JSONB DEFAULT '[]',
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_delivered ON notification_delivery_history(delivered_at DESC);

-- ----------------------------------------------------------------------------
-- 14. INGESTION & AI METRICS LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_job_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES news_sources(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'success', -- success, partial, failed
    articles_fetched INT DEFAULT 0,
    new_stories_created INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type VARCHAR(100) NOT NULL, -- summarize, perspective, translate, dictionary, ask
    provider VARCHAR(50) NOT NULL,   -- openai, claude, grok, fallback
    model_name VARCHAR(100),
    tokens_used INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 15. BROWSER PUSH NOTIFICATION SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    failure_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- ----------------------------------------------------------------------------
-- 16. ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- ----------------------------------------------------------------------------

-- A. Enable RLS on user and private tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ask_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- B. Enable RLS on public editorial tables
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_pulse_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE perspective_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_definitions ENABLE ROW LEVEL SECURITY;

-- C. Public read access policies for editorial news (SELECT only, no public mutations)
DROP POLICY IF EXISTS "Public read on news sources" ON news_sources;
CREATE POLICY "Public read on news sources" ON news_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on articles" ON articles;
CREATE POLICY "Public read on articles" ON articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on canonical stories" ON canonical_stories;
CREATE POLICY "Public read on canonical stories" ON canonical_stories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on story articles" ON story_articles;
CREATE POLICY "Public read on story articles" ON story_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on story timeline" ON story_timeline_events;
CREATE POLICY "Public read on story timeline" ON story_timeline_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on briefings" ON hourly_pulse_briefings;
CREATE POLICY "Public read on briefings" ON hourly_pulse_briefings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on briefing stories" ON briefing_stories;
CREATE POLICY "Public read on briefing stories" ON briefing_stories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on perspectives" ON perspective_analyses;
CREATE POLICY "Public read on perspectives" ON perspective_analyses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on translations" ON cached_translations;
CREATE POLICY "Public read on translations" ON cached_translations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read on definitions" ON cached_definitions;
CREATE POLICY "Public read on definitions" ON cached_definitions FOR SELECT USING (true);

-- D. User profile protection: Users can read only their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT TO authenticated USING (auth.uid() = id);

-- E. User-isolated data policies (Strict cryptographic tenant isolation: auth.uid() = user_id)
DROP POLICY IF EXISTS "Users manage own preferences" ON user_preferences;
CREATE POLICY "Users manage own preferences" ON user_preferences 
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own saved stories" ON saved_stories;
CREATE POLICY "Users manage own saved stories" ON saved_stories 
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own reading history" ON reading_history;
CREATE POLICY "Users manage own reading history" ON reading_history 
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own vocabulary" ON vocabulary_entries;
CREATE POLICY "Users manage own vocabulary" ON vocabulary_entries 
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own vocabulary reviews" ON vocabulary_reviews;
CREATE POLICY "Users manage own vocabulary reviews" ON vocabulary_reviews 
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM vocabulary_entries ve 
            WHERE ve.id = vocabulary_reviews.vocabulary_id AND ve.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM vocabulary_entries ve 
            WHERE ve.id = vocabulary_reviews.vocabulary_id AND ve.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users manage own conversations" ON ask_conversations;
CREATE POLICY "Users manage own conversations" ON ask_conversations 
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own ask messages" ON ask_messages;
CREATE POLICY "Users manage own ask messages" ON ask_messages 
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM ask_conversations ac 
            WHERE ac.id = ask_messages.conversation_id AND ac.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM ask_conversations ac 
            WHERE ac.id = ask_messages.conversation_id AND ac.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users view own notifications" ON notification_delivery_history;
CREATE POLICY "Users view own notifications" ON notification_delivery_history 
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON push_subscriptions 
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 17. SECURE AUTH.USERS -> PUBLIC.USERS SYNCHRONIZATION TRIGGER
-- Hardened SECURITY DEFINER function with restricted search_path and safe defaults
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert into public.users with hardcoded non-privileged security defaults
  -- Never trust client-supplied metadata for administrative or guest privileges!
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
    FALSE, -- Default is_guest to FALSE (not client metadata)
    FALSE, -- Default is_admin to FALSE (strictly non-admin)
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

-- Restrict execution: only Supabase Auth Admin and service_role can trigger
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin, service_role;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

