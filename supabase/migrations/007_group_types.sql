alter table public.groups add column if not exists type text
  check (type in ('roommate', 'listing_inquiry')) default 'roommate';
alter table public.groups add column if not exists listing_id uuid
  references public.listings(id) on delete set null;
alter table public.groups add column if not exists host_id uuid
  references public.users(id) on delete set null;
alter table public.groups add column if not exists listing_address text;
alter table public.groups add column if not exists is_archived boolean default false;

alter table public.group_members add column if not exists is_host boolean default false;
