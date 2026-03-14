-- Run this in the Supabase SQL editor to seed default rooms and optionally suggested profiles.
-- Rooms are required for Communities join/leave and for the profile "Groups" section.

-- Ensure rooms table has required columns (run these if you get "column does not exist" errors)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS member_count int;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Default Smart Communities rooms (ids must match app: equities, macro, crypto)
INSERT INTO rooms (id, name, description, tagline, member_count, created_at, updated_at)
VALUES
  ('equities', 'Global Equities Flow', 'Large-cap, sectors, and index flows', 'Large-cap, sectors, and index flows...', 1200, now(), now()),
  ('macro', 'Global Macro & Rates', 'Rates, FX, and cross-asset macro', 'Rates, FX, and cross-asset macro...', 640, now(), now()),
  ('crypto', 'Crypto & High-Beta', 'Crypto and high-beta risk', 'Crypto and high-beta risk...', 480, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Optional: seed suggested profiles for the "Find People" page (adjust usernames/emails as needed)
-- INSERT INTO profiles (email, name, username, risk_profile, joined_at, created_at, updated_at)
-- VALUES
--   ('sarah@example.com', 'Sarah Chen', 'sarah_macro', 'Moderate', now(), now(), now()),
--   ('mike@example.com', 'Mike Torres', 'torres_flow', 'Aggressive', now(), now(), now());
