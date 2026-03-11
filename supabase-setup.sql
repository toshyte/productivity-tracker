-- Run this SQL in your Supabase SQL Editor to set up the cloud database
-- Go to: Supabase Dashboard > SQL Editor > New Query

-- Web events table (activity intensity pulses from web tracking SDK)
CREATE TABLE IF NOT EXISTS web_events (
    id              BIGSERIAL PRIMARY KEY,
    site_id         TEXT      NOT NULL,
    event_type      TEXT      NOT NULL,
    page_url        TEXT      NOT NULL DEFAULT '',
    page_title      TEXT      NOT NULL DEFAULT '',
    element_tag     TEXT      NOT NULL DEFAULT '',
    element_text    TEXT      NOT NULL DEFAULT '',
    element_id      TEXT      NOT NULL DEFAULT '',
    element_class   TEXT      NOT NULL DEFAULT '',
    metadata        JSONB     NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id         UUID      REFERENCES auth.users(id)
);

-- Indexes for web events
CREATE INDEX IF NOT EXISTS idx_web_events_site_id ON web_events(site_id);
CREATE INDEX IF NOT EXISTS idx_web_events_created_at ON web_events(created_at);
CREATE INDEX IF NOT EXISTS idx_web_events_user_id ON web_events(user_id);
CREATE INDEX IF NOT EXISTS idx_web_events_event_type ON web_events(event_type);

-- Tracking entries table (receives data from desktop and mobile trackers)
CREATE TABLE IF NOT EXISTS tracking_entries (
    id              BIGSERIAL PRIMARY KEY,
    app_name        TEXT      NOT NULL,
    window_title    TEXT      NOT NULL DEFAULT '',
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    duration_s      INTEGER   NOT NULL DEFAULT 0,
    is_idle         BOOLEAN   NOT NULL DEFAULT false,
    device          TEXT      NOT NULL DEFAULT 'desktop',
    user_id         UUID      REFERENCES auth.users(id),
    UNIQUE(start_time, app_name, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_start_time ON tracking_entries(start_time);
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON tracking_entries(user_id);

-- App categories table
CREATE TABLE IF NOT EXISTS app_categories (
    app_name    TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'neutral'
        CHECK(category IN ('productive', 'neutral', 'distracting')),
    user_id     UUID REFERENCES auth.users(id),
    PRIMARY KEY (app_name, user_id)
);

-- Enable Row Level Security (only see your own data)
ALTER TABLE tracking_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only read/write their own data
CREATE POLICY "Users can read own entries"
    ON tracking_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
    ON tracking_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
    ON tracking_entries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can read own categories"
    ON app_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
    ON app_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON app_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can read own web events"
    ON web_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own web events"
    ON web_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to auto-set user_id on insert
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_tracking_user_id
    BEFORE INSERT ON tracking_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_category_user_id
    BEFORE INSERT ON app_categories
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_web_events_user_id
    BEFORE INSERT ON web_events
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();
