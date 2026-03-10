-- Missing RLS policies for interest_cards UPDATE, matches INSERT/UPDATE, boosts UPDATE
-- Run this in the Supabase SQL Editor

-- Interest cards: recipients (hosts) can update status (accept/reject)
create policy "Recipients can update interest cards"
  on public.interest_cards for update
  using (auth.uid() = recipient_id);

-- Matches: users can create matches (for mutual match flow)
create policy "Users can create matches"
  on public.matches for insert
  with check (auth.uid() = user_id_1);

-- Matches: participants can update match status
create policy "Match participants can update"
  on public.matches for update
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- Boosts: users can update own boosts (deactivate expired)
create policy "Users can update own boosts"
  on public.boosts for update
  using (auth.uid() = user_id);

-- Subscriptions: users can insert own subscription (for initial creation)
create policy "Users can insert own subscription"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

-- Notifications: system can create notifications for users
create policy "Authenticated users can create notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- Usage tracking: users can insert own usage record
create policy "Users can insert own usage"
  on public.usage_tracking for insert
  with check (auth.uid() = user_id);
