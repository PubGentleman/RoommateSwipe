-- Row Level Security Policies for Roomdr
-- Run this in the Supabase SQL Editor after 001_schema.sql

-- ============================================
-- USERS
-- ============================================
alter table public.users enable row level security;

create policy "Users can view all users for discovery"
  on public.users for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own record"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update own record"
  on public.users for update
  using (auth.uid() = id);

-- ============================================
-- PROFILES
-- ============================================
alter table public.profiles enable row level security;

create policy "Profiles visible to authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- ============================================
-- LISTINGS
-- ============================================
alter table public.listings enable row level security;

create policy "Listings visible to authenticated users"
  on public.listings for select
  using (auth.role() = 'authenticated');

create policy "Hosts can create listings"
  on public.listings for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update own listings"
  on public.listings for update
  using (auth.uid() = host_id);

create policy "Hosts can delete own listings"
  on public.listings for delete
  using (auth.uid() = host_id);

-- ============================================
-- MATCHES
-- ============================================
alter table public.matches enable row level security;

create policy "Users can view own matches"
  on public.matches for select
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- ============================================
-- INTEREST CARDS
-- ============================================
alter table public.interest_cards enable row level security;

create policy "Users can view received interest cards"
  on public.interest_cards for select
  using (auth.uid() = recipient_id or auth.uid() = sender_id);

create policy "Users can create interest cards"
  on public.interest_cards for insert
  with check (auth.uid() = sender_id);

-- ============================================
-- MESSAGES
-- ============================================
alter table public.messages enable row level security;

create policy "Match participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.matches
      where id = match_id
        and (user_id_1 = auth.uid() or user_id_2 = auth.uid())
    )
  );

create policy "Match participants can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Recipients can update messages (mark read)"
  on public.messages for update
  using (
    exists (
      select 1 from public.matches
      where id = match_id
        and (user_id_1 = auth.uid() or user_id_2 = auth.uid())
    )
  );

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can update own subscription"
  on public.subscriptions for update
  using (auth.uid() = user_id);

-- ============================================
-- BOOSTS
-- ============================================
alter table public.boosts enable row level security;

create policy "Users can view own boosts"
  on public.boosts for select
  using (auth.uid() = user_id);

create policy "Users can create boosts"
  on public.boosts for insert
  with check (auth.uid() = user_id);

create policy "Boosted profiles visible for discovery"
  on public.boosts for select
  using (is_active = true and expires_at > now());

-- ============================================
-- SUPER INTERESTS
-- ============================================
alter table public.super_interests enable row level security;

create policy "Users can view sent/received super interests"
  on public.super_interests for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send super interests"
  on public.super_interests for insert
  with check (auth.uid() = sender_id);

-- ============================================
-- GROUPS
-- ============================================
alter table public.groups enable row level security;

create policy "Groups visible to authenticated users"
  on public.groups for select
  using (auth.role() = 'authenticated');

create policy "Users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "Group creators can update"
  on public.groups for update
  using (auth.uid() = created_by);

create policy "Group creators can delete"
  on public.groups for delete
  using (auth.uid() = created_by);

-- ============================================
-- GROUP MEMBERS
-- ============================================
alter table public.group_members enable row level security;

create policy "Group members visible to authenticated"
  on public.group_members for select
  using (auth.role() = 'authenticated');

create policy "Users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave groups"
  on public.group_members for delete
  using (auth.uid() = user_id);

create policy "Users can update own membership"
  on public.group_members for update
  using (auth.uid() = user_id);

-- ============================================
-- REPORTS
-- ============================================
alter table public.reports enable row level security;

create policy "Users can create reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can view own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- ============================================
-- BLOCKED USERS
-- ============================================
alter table public.blocked_users enable row level security;

create policy "Users can view own blocks"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

create policy "Users can block others"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

create policy "Users can unblock"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- ============================================
-- PROFILE VIEWS
-- ============================================
alter table public.profile_views enable row level security;

create policy "Users can view who viewed them"
  on public.profile_views for select
  using (auth.uid() = viewed_id or auth.uid() = viewer_id);

create policy "Users can create profile views"
  on public.profile_views for insert
  with check (auth.uid() = viewer_id);

-- ============================================
-- USAGE TRACKING
-- ============================================
alter table public.usage_tracking enable row level security;

create policy "Users can view own usage"
  on public.usage_tracking for select
  using (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.usage_tracking for update
  using (auth.uid() = user_id);

-- ============================================
-- ENABLE REALTIME for messages
-- ============================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.matches;
