-- Auto-create public.users row when a new user signs up via Supabase Auth
-- This bypasses RLS using SECURITY DEFINER so the insert always succeeds
-- Run this in the Supabase SQL Editor

create or replace function public.handle_auth_user_created()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, role, onboarding_step, city, state, neighborhood)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'renter'),
    'profile',
    coalesce(new.raw_user_meta_data->>'city', 'New York'),
    coalesce(new.raw_user_meta_data->>'state', 'NY'),
    coalesce(new.raw_user_meta_data->>'neighborhood', 'Williamsburg')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();
