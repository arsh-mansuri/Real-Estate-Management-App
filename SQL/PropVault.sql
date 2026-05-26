-- ============================================================
--  PROPVAULT — COMPLETE SUPABASE SQL
--  Copy-paste this entire file into Supabase SQL Editor.
--  Safe to run on a fresh project (drops nothing you didn't create).
--  Run order: extensions → tables → indexes → triggers → views → RLS
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ─────────────────────────────────────────────────────────────
-- 1. DROP OLD / LEGACY TABLES (if they exist from earlier runs)
--    This clears any schema drift so everything starts clean.
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.dismissed_notifications  CASCADE;
DROP TABLE IF EXISTS public.rent_collections         CASCADE;
DROP TABLE IF EXISTS public.emi_payments             CASCADE;
DROP TABLE IF EXISTS public.property_documents       CASCADE;
DROP TABLE IF EXISTS public.property_rental          CASCADE;
DROP TABLE IF EXISTS public.property_emi             CASCADE;
DROP TABLE IF EXISTS public.properties               CASCADE;
DROP TABLE IF EXISTS public.emi_tracker              CASCADE;   -- legacy table


-- ─────────────────────────────────────────────────────────────
-- 2. DROP VIEWS (recreated below)
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.dashboard_summary;


-- ─────────────────────────────────────────────────────────────
-- 3. DROP FUNCTIONS / TRIGGERS (recreated below)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_updated_at CASCADE;


-- ═══════════════════════════════════════════════════════════════
-- 4. TABLES
-- ═══════════════════════════════════════════════════════════════

-- ── 4a. properties ──────────────────────────────────────────
CREATE TABLE public.properties (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Display
  title                TEXT          NOT NULL,                -- e.g. "Andheri Flat"
  address              TEXT          NOT NULL,                -- full address as one field
  type                 TEXT          NOT NULL DEFAULT 'Residential Flat',
  status               TEXT          NOT NULL DEFAULT 'Vacant',

  -- Financials
  rent                 NUMERIC(14,2) NOT NULL DEFAULT 0,      -- monthly rent; 0 = not rented
  current_value        NUMERIC(14,2) NOT NULL DEFAULT 0,      -- current market value

  -- Media
  image_url            TEXT          NULL,

  -- Timestamps
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT properties_status_chk CHECK (
    status IN ('Vacant', 'On Rent', 'Self-occupied')
  ),
  CONSTRAINT properties_type_chk CHECK (
    type IN ('Residential Flat', 'Commercial Office', 'Plot/Land', 'Agricultural Land', 'Villa / Independent House', 'Other')
  )
);

CREATE INDEX properties_user_id_idx    ON public.properties (user_id);
CREATE INDEX properties_created_at_idx ON public.properties (created_at DESC);


-- ── 4b. property_emi ────────────────────────────────────────
--    One EMI record per property (one active loan at a time).
--    This is the CANONICAL EMI table.
--    Dashboard "Monthly EMI (sum)" tile reads directly from here.
CREATE TABLE public.property_emi (
  property_id            UUID          PRIMARY KEY REFERENCES public.properties (id) ON DELETE CASCADE,
  user_id                UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  lender                 TEXT          NULL,                  -- e.g. "SBI", "HDFC"
  loan_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate          NUMERIC(6,3)  NOT NULL DEFAULT 0,    -- annual %
  emi_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,    -- monthly EMI rupees
  loan_start_date        DATE          NULL,
  loan_tenure_months     INT           NOT NULL DEFAULT 0,
  emi_due_day            INT           NOT NULL DEFAULT 5,    -- day of month EMI is due
  remaining_tenure_months INT          NOT NULL DEFAULT 0,

  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT property_emi_due_day_chk CHECK (emi_due_day BETWEEN 1 AND 28)
);

CREATE INDEX property_emi_user_id_idx ON public.property_emi (user_id);


-- ── 4c. property_rental ─────────────────────────────────────
--    Optional extended rental details per property.
--    The primary rent figure lives in properties.rent.
--    Use this table for tenant details, lease dates, deposit.
CREATE TABLE public.property_rental (
  property_id          UUID          PRIMARY KEY REFERENCES public.properties (id) ON DELETE CASCADE,
  user_id              UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  tenant_name          TEXT          NULL,
  monthly_rent         NUMERIC(12,2) NOT NULL DEFAULT 0,
  rent_collection_day  INT           NOT NULL DEFAULT 1,
  lease_start          DATE          NULL,
  lease_end            DATE          NULL,
  security_deposit     NUMERIC(12,2) NOT NULL DEFAULT 0,

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT property_rental_day_chk CHECK (rent_collection_day BETWEEN 1 AND 28)
);

CREATE INDEX property_rental_user_id_idx ON public.property_rental (user_id);


-- ── 4d. property_documents ──────────────────────────────────
--    Tracks document metadata per property.
CREATE TABLE public.property_documents (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  property_id          UUID          NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,

  doc_type             TEXT          NOT NULL,
  doc_number           TEXT          NULL,
  issuing_authority    TEXT          NULL,
  issue_date           DATE          NULL,
  expiry_date          DATE          NULL,
  notes                TEXT          NULL,
  doc_status           TEXT          NOT NULL DEFAULT 'Available',

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT property_documents_status_chk CHECK (
    doc_status IN ('Available', 'Need to Obtain', 'In Process', 'Expired')
  )
);

CREATE INDEX property_documents_property_id_idx ON public.property_documents (property_id);
CREATE INDEX property_documents_user_id_idx     ON public.property_documents (user_id);


-- ── 4e. emi_payments ────────────────────────────────────────
--    Tracks whether each monthly EMI has been paid.
--    month_key format: "YYYY-MM" e.g. "2025-05"
CREATE TABLE public.emi_payments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  property_id  UUID         NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,

  month_key    TEXT         NOT NULL,
  paid         BOOLEAN      NOT NULL DEFAULT false,
  paid_on      TIMESTAMPTZ  NULL,

  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT emi_payments_month_key_chk         CHECK (month_key ~ '^\d{4}-\d{2}$'),
  CONSTRAINT emi_payments_property_month_uniq   UNIQUE (property_id, month_key)
);

CREATE INDEX emi_payments_user_id_idx     ON public.emi_payments (user_id);
CREATE INDEX emi_payments_property_id_idx ON public.emi_payments (property_id);


-- ── 4f. rent_collections ────────────────────────────────────
--    Tracks rent received (or pending) per property per month.
--    This is what "Rental Income" tab reads and writes.
--    month_key format: "YYYY-MM"
CREATE TABLE public.rent_collections (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  property_id  UUID          NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,

  month_key    TEXT          NOT NULL,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  received     BOOLEAN       NOT NULL DEFAULT false,
  received_on  TIMESTAMPTZ   NULL,

  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT rent_collections_month_key_chk          CHECK (month_key ~ '^\d{4}-\d{2}$'),
  CONSTRAINT rent_collections_property_month_uniq    UNIQUE (property_id, month_key)
);

CREATE INDEX rent_collections_user_id_idx     ON public.rent_collections (user_id);
CREATE INDEX rent_collections_property_id_idx ON public.rent_collections (property_id);


-- ── 4g. dismissed_notifications ─────────────────────────────
--    Tracks which in-app notification banners the user has dismissed.
CREATE TABLE public.dismissed_notifications (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fingerprint       TEXT         NOT NULL,
  notification_type TEXT         NOT NULL,
  property_id       UUID         NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  due_date          DATE         NULL,
  dismissed_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT dismissed_notifications_type_chk CHECK (
    notification_type IN ('EMI', 'Rent', 'Document', 'Lease')
  ),
  CONSTRAINT dismissed_notifications_user_fingerprint_uniq UNIQUE (user_id, fingerprint)
);

CREATE INDEX dismissed_notifications_user_id_idx ON public.dismissed_notifications (user_id);


-- ═══════════════════════════════════════════════════════════════
-- 5. UPDATED_AT TRIGGER
--    Auto-sets updated_at on every row update.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'properties',
    'property_emi',
    'property_rental',
    'property_documents'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s',
      t, t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON public.%s
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 6. DASHBOARD SUMMARY VIEW
--    Single source of truth for ALL dashboard tiles.
--
--    Columns returned:
--      user_id                — who owns the data
--      total_properties       — count of properties
--      total_portfolio_value  — sum of current_value across properties
--      total_monthly_emi      — sum of emi_amount from property_emi
--                               ↕ THIS IS what "Monthly EMI (sum)" tile on
--                                 Dashboard AND "Total Monthly EMI" tile on
--                                 EMI Tracker both display. Same number, same
--                                 source, always in sync.
--      total_monthly_rent     — sum of rent from properties (for rented ones)
--      net_per_month          — total_monthly_rent − total_monthly_emi
--                               ↕ THIS IS what "Net / Month" tile displays.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.dashboard_summary AS
SELECT
  p.user_id,
  COUNT(p.id)::INT                                           AS total_properties,
  COALESCE(SUM(p.current_value),       0)::NUMERIC(18,2)    AS total_portfolio_value,
  COALESCE(SUM(e.emi_amount),          0)::NUMERIC(18,2)    AS total_monthly_emi,
  COALESCE(SUM(
    CASE WHEN p.rent > 0 THEN p.rent ELSE 0 END
  ), 0)::NUMERIC(18,2)                                       AS total_monthly_rent,
  (
    COALESCE(SUM(CASE WHEN p.rent > 0 THEN p.rent ELSE 0 END), 0)
    - COALESCE(SUM(e.emi_amount), 0)
  )::NUMERIC(18,2)                                           AS net_per_month
FROM  public.properties  p
LEFT  JOIN public.property_emi e ON e.property_id = p.id
GROUP BY p.user_id;

-- Make the view respect RLS of the underlying tables
ALTER VIEW public.dashboard_summary SET (security_invoker = true);


-- ═══════════════════════════════════════════════════════════════
-- 7. ROW LEVEL SECURITY
--    Every user can only see, insert, update, delete their own rows.
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.properties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_emi             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_rental          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_collections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_notifications  ENABLE ROW LEVEL SECURITY;


-- ── properties ──────────────────────────────────────────────
CREATE POLICY "properties: select own"
  ON public.properties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "properties: insert own"
  ON public.properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "properties: update own"
  ON public.properties FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "properties: delete own"
  ON public.properties FOR DELETE
  USING (auth.uid() = user_id);


-- ── property_emi ────────────────────────────────────────────
CREATE POLICY "property_emi: select own"
  ON public.property_emi FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "property_emi: insert own"
  ON public.property_emi FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "property_emi: update own"
  ON public.property_emi FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "property_emi: delete own"
  ON public.property_emi FOR DELETE
  USING (auth.uid() = user_id);


-- ── property_rental ─────────────────────────────────────────
CREATE POLICY "property_rental: select own"
  ON public.property_rental FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "property_rental: insert own"
  ON public.property_rental FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "property_rental: update own"
  ON public.property_rental FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "property_rental: delete own"
  ON public.property_rental FOR DELETE
  USING (auth.uid() = user_id);


-- ── property_documents ──────────────────────────────────────
CREATE POLICY "property_documents: select own"
  ON public.property_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "property_documents: insert own"
  ON public.property_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "property_documents: update own"
  ON public.property_documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "property_documents: delete own"
  ON public.property_documents FOR DELETE
  USING (auth.uid() = user_id);


-- ── emi_payments ────────────────────────────────────────────
CREATE POLICY "emi_payments: select own"
  ON public.emi_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "emi_payments: insert own"
  ON public.emi_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "emi_payments: update own"
  ON public.emi_payments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "emi_payments: delete own"
  ON public.emi_payments FOR DELETE
  USING (auth.uid() = user_id);


-- ── rent_collections ────────────────────────────────────────
CREATE POLICY "rent_collections: select own"
  ON public.rent_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "rent_collections: insert own"
  ON public.rent_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rent_collections: update own"
  ON public.rent_collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rent_collections: delete own"
  ON public.rent_collections FOR DELETE
  USING (auth.uid() = user_id);


-- ── dismissed_notifications ─────────────────────────────────
CREATE POLICY "dismissed_notifications: select own"
  ON public.dismissed_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "dismissed_notifications: insert own"
  ON public.dismissed_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dismissed_notifications: update own"
  ON public.dismissed_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dismissed_notifications: delete own"
  ON public.dismissed_notifications FOR DELETE
  USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════
-- 8. VERIFY — run this SELECT after applying to confirm all
--    tables and the view exist with the right columns.
--    (Optional — you can delete this block before pasting)
-- ═══════════════════════════════════════════════════════════════
/*
SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
ORDER  BY table_name;

SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'dashboard_summary'
ORDER  BY ordinal_position;
*/


-- ═══════════════════════════════════════════════════════════════
-- DONE.
-- Tables created:
--   properties              ← core property rows
--   property_emi            ← one EMI record per property (loan details)
--   property_rental         ← extended rental / tenant details
--   property_documents      ← document metadata per property
--   emi_payments            ← monthly paid/unpaid log per property
--   rent_collections        ← monthly rent received/pending log
--   dismissed_notifications ← tracks dismissed UI alerts
--
-- View created:
--   dashboard_summary       ← aggregated tiles for the dashboard
--                             All four Home.js dashboard tiles AND
--                             Dashboard.js tiles read from this view.
--                             EMI Tracker "Total Monthly EMI" tile
--                             and Dashboard "Monthly EMI (sum)" tile
--                             are always in sync because they both read
--                             property_emi.emi_amount via this view.
-- ═══════════════════════════════════════════════════════════════