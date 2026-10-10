-- Aangan Studio lead qualification: database tables.
-- Safe to run more than once (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS calls (
  id                    SERIAL PRIMARY KEY,
  vaani_call_id         TEXT UNIQUE,            -- Vaani's own ID; stops duplicate webhooks
  caller_phone          TEXT,
  caller_name           TEXT,
  email                 TEXT,
  property_type         TEXT,                   -- e.g. 2BHK flat, small office
  area_sqft             INTEGER,
  scope                 TEXT,                   -- e.g. full home, kitchen only
  budget_lakh           NUMERIC(6,2),           -- budget in lakh rupees
  timeline              TEXT,
  transcript            TEXT,
  recording_url         TEXT,
  qualification_status  TEXT NOT NULL DEFAULT 'unqualified'
                        CHECK (qualification_status IN ('qualified', 'unqualified')),
  qualification_reason  TEXT,
  overridden_by_staff   BOOLEAN NOT NULL DEFAULT FALSE,  -- front desk re-qualified it
  call_started_at       TIMESTAMPTZ,
  call_duration_sec     INTEGER,
  answered_within_5min  BOOLEAN NOT NULL DEFAULT TRUE,   -- the AI picks up instantly
  after_hours           BOOLEAN NOT NULL DEFAULT FALSE,  -- outside 10am-7pm
  vaani_cost            NUMERIC(10,4) NOT NULL DEFAULT 0, -- INR
  llm_cost              NUMERIC(10,4) NOT NULL DEFAULT 0, -- INR
  system_cost           NUMERIC(10,4) GENERATED ALWAYS AS (vaani_cost + llm_cost) STORED,
  hubspot_contact_id    TEXT,
  telegram_sent         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_bookings (
  id                SERIAL PRIMARY KEY,
  call_id           INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  google_event_id   TEXT,
  slot_start        TIMESTAMPTZ NOT NULL,
  slot_end          TIMESTAMPTZ NOT NULL,
  invitee_email     TEXT,
  status            TEXT NOT NULL DEFAULT 'booked'
                    CHECK (status IN ('booked', 'cancelled', 'completed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_status  ON calls (qualification_status);
CREATE INDEX IF NOT EXISTS idx_calls_created ON calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_call ON calendar_bookings (call_id);

-- Added in Step 3
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_type       TEXT NOT NULL DEFAULT 'enquiry';  -- enquiry | complaint | missed
ALTER TABLE calls ADD COLUMN IF NOT EXISTS handoff_note    TEXT;                              -- gaps for the designer
ALTER TABLE calls ADD COLUMN IF NOT EXISTS pricing_flagged BOOLEAN NOT NULL DEFAULT FALSE;    -- agent may have quoted a price
ALTER TABLE calls ADD COLUMN IF NOT EXISTS raw_payload     JSONB;                             -- exactly what Vaani sent

-- Added in Step 4: bookings are made DURING the call, before the call row exists.
ALTER TABLE calendar_bookings ALTER COLUMN call_id DROP NOT NULL;
ALTER TABLE calendar_bookings ADD COLUMN IF NOT EXISTS vaani_call_id TEXT;
ALTER TABLE calendar_bookings ADD COLUMN IF NOT EXISTS invitee_name  TEXT;

-- Switched from Google Calendar to Cal.com
ALTER TABLE calendar_bookings ADD COLUMN IF NOT EXISTS cal_booking_uid TEXT;

-- Step 5: dashboard
ALTER TABLE calls ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;  -- sample data, safe to wipe

-- Location and project dates as proper fields
ALTER TABLE calls ADD COLUMN IF NOT EXISTS location   TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS start_date DATE;   -- when work can start (site ready / immediately)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS end_date   DATE;   -- when the project must be finished
