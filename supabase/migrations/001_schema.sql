-- Roomdr Database Schema
-- Run this in the Supabase SQL Editor to create all tables

-- ============================================
-- USERS TABLE
-- ============================================
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  role text check (role in ('renter', 'host')) not null default 'renter',
  full_name text,
  avatar_url text,
  bio text,
  age integer,
  birthday date,
  zodiac_sign text,
  gender text,
  occupation text,
  location text,
  neighborhood text,
  city text,
  state text,
  onboarding_step text check (onboarding_step in ('profile', 'plan', 'complete')) default 'profile',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- PROFILES TABLE (renter profile details)
-- ============================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique not null,
  budget_min integer,
  budget_max integer,
  move_in_date date,
  lease_duration text,
  room_type text,
  looking_for text,
  work_location text check (work_location in ('wfh_fulltime', 'hybrid', 'office_fulltime', 'irregular')),
  cleanliness integer check (cleanliness between 1 and 5),
  noise_tolerance integer check (noise_tolerance between 1 and 5),
  sleep_schedule text,
  wake_time text,
  sleep_time text,
  pets text,
  smoking boolean default false,
  drinking text,
  guests text,
  interests text[],
  photos text[],
  private_bathroom boolean default false,
  bathrooms integer default 1,
  coordinates jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- LISTINGS TABLE (host property listings)
-- ============================================
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  description text,
  rent integer not null,
  bedrooms integer,
  bathrooms integer,
  address text,
  city text,
  state text,
  neighborhood text,
  room_type text,
  amenities text[],
  photos text[],
  available_date date,
  is_active boolean default true,
  is_paused boolean default false,
  is_rented boolean default false,
  coordinates jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- MATCHES TABLE
-- ============================================
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id_1 uuid references public.users(id) on delete cascade not null,
  user_id_2 uuid references public.users(id) on delete cascade not null,
  match_type text check (match_type in ('mutual', 'super_interest', 'cold')) default 'mutual',
  status text check (status in ('pending', 'matched', 'rejected')) default 'pending',
  compatibility_score integer,
  created_at timestamptz default now(),
  unique(user_id_1, user_id_2)
);

-- ============================================
-- INTEREST CARDS TABLE (swipe actions)
-- ============================================
create table if not exists public.interest_cards (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete cascade not null,
  recipient_id uuid references public.users(id) on delete cascade not null,
  action text check (action in ('like', 'pass', 'super_interest')) not null,
  created_at timestamptz default now(),
  unique(sender_id, recipient_id)
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- CONVERSATIONS VIEW (derived from matches + messages)
-- ============================================
create or replace view public.conversations as
select
  m.id as match_id,
  m.user_id_1,
  m.user_id_2,
  m.match_type,
  m.status,
  m.compatibility_score,
  m.created_at as matched_at,
  (select content from public.messages where match_id = m.id order by created_at desc limit 1) as last_message,
  (select created_at from public.messages where match_id = m.id order by created_at desc limit 1) as last_message_at,
  (select count(*) from public.messages where match_id = m.id and read = false) as unread_count
from public.matches m
where m.status = 'matched';

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique not null,
  plan text check (plan in ('basic', 'plus', 'elite', 'starter', 'pro', 'business')) default 'basic',
  billing_cycle text check (billing_cycle in ('monthly', '3month', 'annual')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text check (status in ('active', 'cancelled', 'cancelling', 'past_due', 'trialing')) default 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- BOOSTS TABLE
-- ============================================
create table if not exists public.boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  is_active boolean default true,
  expires_at timestamptz not null,
  duration_hours integer check (duration_hours in (12, 24, 48)),
  created_at timestamptz default now()
);

-- ============================================
-- SUPER INTERESTS TABLE
-- ============================================
create table if not exists public.super_interests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete cascade not null,
  recipient_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(sender_id, recipient_id)
);

-- ============================================
-- GROUPS TABLE
-- ============================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  city text,
  state text,
  max_members integer default 4,
  budget_min integer,
  budget_max integer,
  move_in_date date,
  photo_url text,
  created_by uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- GROUP MEMBERS TABLE
-- ============================================
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role text check (role in ('admin', 'member')) default 'member',
  status text check (status in ('active', 'pending', 'left')) default 'active',
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

-- ============================================
-- REPORTS TABLE
-- ============================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete cascade not null,
  reported_id uuid references public.users(id) on delete cascade not null,
  reported_type text check (reported_type in ('user', 'listing', 'group')) default 'user',
  reason text not null,
  details text,
  status text check (status in ('pending', 'reviewed', 'resolved', 'dismissed')) default 'pending',
  created_at timestamptz default now()
);

-- ============================================
-- BLOCKED USERS TABLE
-- ============================================
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references public.users(id) on delete cascade not null,
  blocked_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- PROFILE VIEWS TABLE
-- ============================================
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid references public.users(id) on delete cascade not null,
  viewed_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- ============================================
-- USAGE TRACKING TABLE
-- ============================================
create table if not exists public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique not null,
  interest_cards_today integer default 0,
  interest_cards_reset_date date default current_date,
  messages_this_month integer default 0,
  messages_reset_date date default date_trunc('month', current_date),
  super_interests_this_month integer default 0,
  super_interests_reset_date date default date_trunc('month', current_date),
  cold_messages_this_month integer default 0,
  cold_messages_reset_date date default date_trunc('month', current_date),
  rewinds_today integer default 0,
  rewinds_reset_date date default current_date,
  updated_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_city on public.users(city);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_listings_host_id on public.listings(host_id);
create index if not exists idx_listings_city on public.listings(city);
create index if not exists idx_listings_active on public.listings(is_active);
create index if not exists idx_matches_user1 on public.matches(user_id_1);
create index if not exists idx_matches_user2 on public.matches(user_id_2);
create index if not exists idx_messages_match_id on public.messages(match_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_interest_cards_sender on public.interest_cards(sender_id);
create index if not exists idx_interest_cards_recipient on public.interest_cards(recipient_id);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_groups_city on public.groups(city);
create index if not exists idx_blocked_blocker on public.blocked_users(blocker_id);
create index if not exists idx_boosts_user on public.boosts(user_id);
create index if not exists idx_super_interests_sender on public.super_interests(sender_id);
create index if not exists idx_super_interests_recipient on public.super_interests(recipient_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_users_updated_at before update on public.users
  for each row execute function public.handle_updated_at();
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_listings_updated_at before update on public.listings
  for each row execute function public.handle_updated_at();
create trigger set_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.handle_updated_at();
create trigger set_groups_updated_at before update on public.groups
  for each row execute function public.handle_updated_at();
create trigger set_usage_updated_at before update on public.usage_tracking
  for each row execute function public.handle_updated_at();

-- ============================================
-- NEW USER TRIGGER (auto-create related records)
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'basic', 'active');

  insert into public.usage_tracking (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_user_created after insert on public.users
  for each row execute function public.handle_new_user();

-- ============================================
-- MUTUAL MATCH DETECTION TRIGGER
-- ============================================
create or replace function public.check_mutual_match()
returns trigger as $$
declare
  reverse_exists boolean;
  new_match_id uuid;
begin
  if new.action = 'like' or new.action = 'super_interest' then
    select exists(
      select 1 from public.interest_cards
      where sender_id = new.recipient_id
        and recipient_id = new.sender_id
        and action in ('like', 'super_interest')
    ) into reverse_exists;

    if reverse_exists then
      new_match_id := gen_random_uuid();
      insert into public.matches (id, user_id_1, user_id_2, match_type, status)
      values (
        new_match_id,
        least(new.sender_id, new.recipient_id),
        greatest(new.sender_id, new.recipient_id),
        case when new.action = 'super_interest' then 'super_interest' else 'mutual' end,
        'matched'
      )
      on conflict (user_id_1, user_id_2) do update set status = 'matched';

      insert into public.notifications (user_id, type, title, body, data)
      values
        (new.sender_id, 'match', 'New Match!', 'You matched with someone!', jsonb_build_object('match_id', new_match_id, 'other_user_id', new.recipient_id)),
        (new.recipient_id, 'match', 'New Match!', 'You matched with someone!', jsonb_build_object('match_id', new_match_id, 'other_user_id', new.sender_id));
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_interest_card_created after insert on public.interest_cards
  for each row execute function public.check_mutual_match();
