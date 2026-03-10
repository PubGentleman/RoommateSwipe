-- Migration 004: Add missing columns to listings, groups, interest_cards, and users tables

-- Add missing columns to listings table
alter table if exists public.listings
add column if not exists property_type text,
add column if not exists sqft integer;

-- Add missing columns to groups table
alter table if exists public.groups
add column if not exists apartment_price integer,
add column if not exists bedrooms integer;

-- Add status and responded_at columns to interest_cards table
alter table if exists public.interest_cards
add column if not exists status text check (status in ('pending', 'accepted', 'passed', 'expired')) default 'pending',
add column if not exists responded_at timestamptz,
add column if not exists listing_id uuid references public.listings(id) on delete set null,
add column if not exists listing_title text,
add column if not exists compatibility_score integer,
add column if not exists budget_range text,
add column if not exists move_in_date text,
add column if not exists lifestyle_tags text[],
add column if not exists personal_note text;

-- Add verification and privacy settings JSONB columns to users table
alter table if exists public.users
add column if not exists verification jsonb default '{}',
add column if not exists privacy_settings jsonb default '{}';
