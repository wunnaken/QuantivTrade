-- MIGRATION 002: Move localStorage data to Supabase
-- Run this in the Supabase SQL editor once.

-- ─── Columns on profiles ────────────────────────────────────────────────────
-- ui_preferences (already exists; accent_color + theme stored inside it)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ui_preferences jsonb DEFAULT '{}';
-- Invite system
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_count int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_early_member boolean DEFAULT false;
-- Archive: recently viewed slugs (max 10)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archive_recent jsonb DEFAULT '[]';

-- ─── User engagement: XP + daily streaks ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_engagement (
  user_id       uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  xp_from_trades      int DEFAULT 0,
  xp_from_streak_days int DEFAULT 0,
  xp_from_posts       int DEFAULT 0,
  xp_from_reactions   int DEFAULT 0,
  login_streak        int DEFAULT 0,
  journal_streak      int DEFAULT 0,
  briefing_streak     int DEFAULT 0,
  last_login          text DEFAULT '',
  last_journal        text DEFAULT '',
  last_briefing       text DEFAULT '',
  best_login_streak   int DEFAULT 0,
  best_journal_streak int DEFAULT 0,
  best_briefing_streak int DEFAULT 0,
  login_history    boolean[] DEFAULT ARRAY[false,false,false,false,false,false,false],
  journal_history  boolean[] DEFAULT ARRAY[false,false,false,false,false,false,false],
  briefing_history boolean[] DEFAULT ARRAY[false,false,false,false,false,false,false],
  updated_at timestamptz DEFAULT now()
);

-- ─── Prediction markets ──────────────────────────────────────────────────────
-- Per-user points + daily claim
CREATE TABLE IF NOT EXISTS predict_user_state (
  user_id          uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  points           int DEFAULT 1000,
  last_daily_claim bigint DEFAULT 0,
  updated_at       timestamptz DEFAULT now()
);

-- Community-created markets (the preloaded ones are seeded below)
CREATE TABLE IF NOT EXISTS predict_markets (
  id                   text PRIMARY KEY,
  question             text NOT NULL,
  category             text NOT NULL,
  close_date           text NOT NULL,
  created_at           timestamptz DEFAULT now(),
  created_by           text NOT NULL,
  yes_points           int DEFAULT 50,
  no_points            int DEFAULT 50,
  resolution_criteria  text,
  initial_yes_percent  int DEFAULT 50,
  status               text DEFAULT 'open',
  outcome              text,
  resolved_at          timestamptz,
  resolved_by          text,
  last_bet_at          timestamptz
);

-- Individual bets
CREATE TABLE IF NOT EXISTS predict_bets (
  id           text PRIMARY KEY,
  market_id    text REFERENCES predict_markets(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_name    text,
  side         text NOT NULL,
  amount       int NOT NULL,
  odds_at_bet  float NOT NULL,
  placed_at    timestamptz DEFAULT now(),
  status       text DEFAULT 'open',
  payout       int,
  resolved_at  timestamptz
);

-- ─── Marketplace: per-user state ────────────────────────────────────────────
-- Tracks which content-update banners each buyer has acknowledged or deferred,
-- and stores their "old version" title snapshot for the diff view.
-- mp_disc_dismissed lives in profiles.ui_preferences (no separate table needed).
CREATE TABLE IF NOT EXISTS marketplace_user_state (
  user_id    uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  ack_at     text,       -- ISO timestamp: last accepted content update
  defer_at   text,       -- ISO timestamp: last "not now" on content update
  titles     jsonb DEFAULT '[]',  -- snapshot of slide titles at last ack
  PRIMARY KEY (user_id, listing_id)
);

-- ─── Whiteboard boards ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whiteboard_boards (
  id         text NOT NULL,
  user_id    uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name       text NOT NULL,
  scene      jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

-- ─── Seed: default prediction markets ───────────────────────────────────────
INSERT INTO predict_markets (id, question, category, close_date, created_by, yes_points, no_points, initial_yes_percent, status)
VALUES
  ('preload-0-2026-03-31','Will the S&P 500 close above 5,800 by end of March 2026?','Finance','2026-03-31','QuantivTrade',58,42,58,'open'),
  ('preload-1-2026-04-01','Will NVDA hit $1,100 before April 2026?','Finance','2026-04-01','QuantivTrade',34,66,34,'open'),
  ('preload-2-2026-06-30','Will Apple announce a stock split in Q2 2026?','Finance','2026-06-30','QuantivTrade',22,78,22,'open'),
  ('preload-3-2026-03-20','Will the Fed cut rates at the March 2026 FOMC meeting?','Finance','2026-03-20','QuantivTrade',12,88,12,'open'),
  ('preload-4-2026-05-01','Will Bitcoin reach $100K before May 1, 2026?','Crypto','2026-05-01','QuantivTrade',61,39,61,'open'),
  ('preload-5-2026-12-31','Will Ethereum flip Bitcoin in market cap by end of 2026?','Crypto','2026-12-31','QuantivTrade',8,92,8,'open'),
  ('preload-6-2026-03-31','Will a spot Ethereum ETF see $1B inflows in March 2026?','Crypto','2026-03-31','QuantivTrade',44,56,44,'open'),
  ('preload-7-2026-06-15','Will US inflation (CPI) fall below 2.5% by June 2026?','Macro','2026-06-15','QuantivTrade',38,62,38,'open'),
  ('preload-8-2026-12-31','Will the US enter a recession in 2026?','Macro','2026-12-31','QuantivTrade',29,71,29,'open'),
  ('preload-9-2026-06-30','Will the dollar index (DXY) fall below 100 by mid 2026?','Macro','2026-06-30','QuantivTrade',45,55,45,'open'),
  ('preload-10-2026-12-31','Will there be a US government shutdown in 2026?','Politics','2026-12-31','QuantivTrade',41,59,41,'open'),
  ('preload-11-2026-12-31','Will the UK cut interest rates 3+ times in 2026?','Politics','2026-12-31','QuantivTrade',52,48,52,'open')
ON CONFLICT (id) DO NOTHING;
