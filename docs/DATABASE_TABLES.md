# Xchange — Data Moving from Hardcode to Supabase

Use this list to create your Supabase tables. **Special requirements** are called out where needed.

---

## 1. **Users / auth (profiles)**

**Currently:** Demo auth in localStorage; user object with id, name, email, username, bio, profilePicture, bannerImage, joinedAt, riskProfile.

**Tables:**

### `profiles`
| Column | Type | Notes |
|--------|------|--------|
| id | uuid (PK) | Use `auth.users.id` when using Supabase Auth |
| email | text | NOT NULL, UNIQUE |
| name | text | |
| username | text | Unique handle (e.g. sarah_macro) |
| bio | text | |
| profile_picture_url | text | |
| banner_image_url | text | |
| risk_profile | text | 'passive' \| 'moderate' \| 'aggressive' |
| joined_at | timestamptz | DEFAULT now() |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Special:** If you use **Supabase Auth**, enable "Create profile on signup" (trigger) so each `auth.users` row gets a matching `profiles` row. Otherwise you can use `profiles` as the only user store and handle auth yourself.

---

## 2. **Feed posts**

**Currently:** `SAMPLE_POSTS` in feed/page + reaction counts + “current user’s reactions” per post.

**Tables:**

### `posts`
| Column | Type | Notes |
|--------|------|--------|
| id | uuid (PK) | DEFAULT gen_random_uuid() |
| author_id | uuid (FK → profiles) | NOT NULL |
| content | text | NOT NULL |
| created_at | timestamptz | DEFAULT now() |
| comments_count | int | DEFAULT 0 (or derive from comments table) |

### `post_reactions`
Stores **counts per reaction type** per post (so we can increment/decrement).

| Column | Type | Notes |
|--------|------|--------|
| post_id | uuid (FK → posts) | NOT NULL |
| reaction_type | text | 'bullish' \| 'bearish' \| 'informative' \| 'risky' \| 'interesting' |
| count | int | DEFAULT 0 |
| updated_at | timestamptz | |

**Unique:** `(post_id, reaction_type)`.

### `user_post_reactions`
Which **reaction type** the current user has given per post (one per type per user per post).

| Column | Type | Notes |
|--------|------|--------|
| user_id | uuid (FK → profiles) | NOT NULL |
| post_id | uuid (FK → posts) | NOT NULL |
| reaction_type | text | Same 5 values |
| created_at | timestamptz | |

**Unique:** `(user_id, post_id, reaction_type)` so a user can only have one “bullish”, one “bearish”, etc. per post.

**Special:** When a user adds a reaction: insert into `user_post_reactions` and increment the corresponding `post_reactions.count`. When they remove it: delete from `user_post_reactions` and decrement `post_reactions.count`.

---

## 3. **Watchlist**

**Currently:** localStorage; list of `{ ticker, name?, price?, change? }` per user.

**Table:**

### `watchlist`
| Column | Type | Notes |
|--------|------|--------|
| id | uuid (PK) | |
| user_id | uuid (FK → profiles) | NOT NULL |
| ticker | text | NOT NULL (e.g. AAPL, BTC) |
| name | text | Optional display name |
| created_at | timestamptz | |

**Unique:** `(user_id, ticker)` so a user can’t add the same ticker twice.

**Special:** None. Price/change can stay client-side or be filled by an API later.

---

## 4. **Follows (who each user follows)**

**Currently:** localStorage list of user IDs/handles (`getFollowed()`).

**Table:**

### `follows`
| Column | Type | Notes |
|--------|------|--------|
| follower_id | uuid (FK → profiles) | NOT NULL |
| followed_id | uuid (FK → profiles) | NOT NULL |
| created_at | timestamptz | |

**Unique:** `(follower_id, followed_id)`.

**Special:** Prevent self-follow: add a check (e.g. trigger or app logic) so `follower_id ≠ followed_id`.

---

## 5. **Suggested people / discover**

**Currently:** `SUGGESTED_PEOPLE` — same shape as profiles (id, name, handle, riskProfile, interests).

**Options:**

- **A)** Use `profiles` as the only user table; “suggested” = query profiles (e.g. by interests, or a `suggested` flag).
- **B)** Keep a small **reference list** of profile IDs that are “suggested” in a table like `suggested_profile_ids (profile_id)` and join to `profiles`.

**If you add a `profiles` column for interests:**

- `interests` — text[] or jsonb (e.g. `["Crypto","ETFs"]`).

No extra table is strictly required if “suggested” is just a query over `profiles`.

---

## 6. **Communities / rooms**

**Currently:** Three hardcoded rooms (equities, macro, crypto) with names and copy; `ROOM_NAMES`, room content in components.

**Tables:**

### `rooms`
| Column | Type | Notes |
|--------|------|--------|
| id | text (PK) | e.g. 'equities', 'macro', 'crypto' |
| name | text | e.g. 'Global Equities Flow' |
| description | text | Short blurb |
| tagline | text | e.g. 'Large-cap, sectors, and index flows...' |
| member_count | int | Can be cached/cached and updated periodically |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `room_members` (user joined rooms)

**Currently:** `getJoinedRooms()` — list of room names per user.

| Column | Type | Notes |
|--------|------|--------|
| user_id | uuid (FK → profiles) | NOT NULL |
| room_id | text (FK → rooms) | NOT NULL |
| joined_at | timestamptz | |

**Unique:** `(user_id, room_id)`.

**Special:** None.

---

## 7. **Messages (DMs and group chats)**

**Currently:** `SAMPLE_DMS` and `SAMPLE_GROUPS`; conversations and messages in memory.

**Tables:**

### `conversations`
| Column | Type | Notes |
|--------|------|--------|
| id | uuid (PK) | |
| type | text | 'dm' \| 'group' |
| name | text | For groups only (e.g. 'Global Equities Flow') |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `conversation_participants`
| Column | Type | Notes |
|--------|------|--------|
| conversation_id | uuid (FK → conversations) | NOT NULL |
| user_id | uuid (FK → profiles) | NOT NULL |
| role | text | e.g. 'member' (optional) |
| joined_at | timestamptz | |

**Unique:** `(conversation_id, user_id)`.

- **DM:** one row per participant (2 rows for a 1:1 DM).
- **Group:** one row per member.

### `messages`
| Column | Type | Notes |
|--------|------|--------|
| id | uuid (PK) | |
| conversation_id | uuid (FK → conversations) | NOT NULL |
| sender_id | uuid (FK → profiles) | NOT NULL (or null for system) |
| text | text | NOT NULL |
| created_at | timestamptz | DEFAULT now() |

**Special:** For “last message” and “unread count” you can either:
- Store `last_message_at` and `last_message_preview` on `conversations` and update them when a message is inserted, or
- Query the latest message and unread counts when loading the list.

**Unread:** Add something like `message_reads (message_id, user_id, read_at)` or a `last_read_at` per participant per conversation so you can compute unread counts.

---

## 8. **Profile posts (user’s own posts on profile)**

**Currently:** `StoredPost` in localStorage (`xchange-demo-posts`): id, text, date, groupName.

**Options:**

- **A)** Use the same **`posts`** table as the feed; profile page shows posts where `author_id = current user`.
- **B)** Separate `profile_posts` if you want different fields (e.g. “pinned”, “group”).  

Recommendation: use **one `posts`** table; profile = “posts where author_id = me”.

**Special:** None if you reuse `posts`.

---

## 9. **Sidebar preferences (order + hidden tabs)**

**Currently:** localStorage: `order` (array of hrefs), `hidden` (array of hrefs).

**Table (optional):**

### `user_sidebar_prefs`
| Column | Type | Notes |
|--------|------|--------|
| user_id | uuid (FK → profiles) | PK |
| nav_order | text[] | e.g. ['/feed','/communities',...] |
| nav_hidden | text[] | e.g. ['/ai'] |
| updated_at | timestamptz | |

**Special:** One row per user. Upsert on save. If you prefer to keep this in localStorage only (no cross-device), you can skip this table.

---

## 10. **Plans (pricing)**

**Currently:** `PLANS` array: id, name, price, period, tagline, features[], cta, href, accent, popular.

**Table:**

### `plans`
| Column | Type | Notes |
|--------|------|--------|
| id | text (PK) | e.g. 'starter', 'pro', 'institution' |
| name | text | |
| price | int | e.g. 19 (cents or dollars, be consistent) |
| period | text | e.g. 'month' |
| tagline | text | |
| features | jsonb or text[] | Array of feature strings |
| cta | text | Button text |
| href | text | Link |
| accent | text | e.g. 'emerald', 'green' |
| popular | boolean | DEFAULT false |
| sort_order | int | For display order |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Special:** None. Good candidate for RLS “public read, no write” (or only service role can write).

---

## 11. **Trending tickers / active communities (feed sidebar)**

**Currently:** `TRENDING_TICKERS` and `ACTIVE_COMMUNITIES` hardcoded on the feed.

**Options:**

- **Trending:** Table `trending_tickers (symbol, name, change, updated_at)` or a small config table; or keep hardcoded until you have a real data source.
- **Active communities:** Can be the first N **rooms** from `rooms` (e.g. by member_count or a `featured` flag).

**Tables (optional):**

### `trending_tickers` (or config)
| Column | Type | Notes |
|--------|------|--------|
| symbol | text (PK) | e.g. SPY |
| name | text | |
| change_percent | decimal | |
| updated_at | timestamptz | |

**Special:** If you use a cron or worker to refresh this, make sure only the backend (service role) writes to it.

---

## 12. **Search suggestion tickers**

**Currently:** `SUGGESTION_TICKERS` — short list of ticker symbols.

**Table (optional):**

### `search_suggestion_tickers`
| Column | Type | Notes |
|--------|------|--------|
| symbol | text (PK) | |
| sort_order | int | For ordering in dropdown |

**Special:** None. Can stay hardcoded until you want it editable.

---

## Summary: tables to create (in order)

| # | Table | Purpose |
|---|--------|--------|
| 1 | **profiles** | Users (and suggested people if you use it for discover) |
| 2 | **posts** | Feed + profile posts |
| 3 | **post_reactions** | Reaction counts per post |
| 4 | **user_post_reactions** | Which reaction each user gave per post |
| 5 | **watchlist** | User watchlist items |
| 6 | **follows** | Who follows whom |
| 7 | **rooms** | Community rooms (equities, macro, crypto, etc.) |
| 8 | **room_members** | User ↔ room membership |
| 9 | **conversations** | DM and group conversations |
| 10 | **conversation_participants** | Who is in each conversation |
| 11 | **messages** | Chat messages |
| 12 | **plans** | Pricing plans (optional but useful) |
| 13 | **user_sidebar_prefs** | Sidebar order/hidden (optional) |
| 14 | **trending_tickers** | Feed sidebar (optional) |
| 15 | **search_suggestion_tickers** | Search dropdown (optional) |

**Not moving to DB (stay in code or localStorage):**

- **Theme** (dark/light) — can stay in localStorage or add a column on `profiles`.
- **Plans floating tab** (hidden until X time) — localStorage is fine.
- **Communities intro dismissed** — localStorage is fine.
- **News fallback articles** — stay in code as fallback.
- **Nav items (MAIN_NAV, BOTTOM_NAV)** — stay in code unless you want a CMS for nav.

After you create the tables, we can wire the app to Supabase (auth, feed, watchlist, follows, rooms, messages, etc.) step by step.
