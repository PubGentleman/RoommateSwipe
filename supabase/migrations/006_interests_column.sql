-- Add interests column to profiles table
alter table public.profiles add column if not exists interests text[] default '{}';
