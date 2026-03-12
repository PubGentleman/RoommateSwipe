alter table public.groups add column if not exists type text
  check (type in ('roommate', 'listing_inquiry')) default 'roommate';
alter table public.groups add column if not exists listing_id uuid
  references public.listings(id) on delete set null;
alter table public.groups add column if not exists host_id uuid
  references public.users(id) on delete set null;
alter table public.groups add column if not exists listing_address text;
alter table public.groups add column if not exists is_archived boolean default false;

alter table public.group_members add column if not exists is_host boolean default false;

alter table public.group_members drop constraint if exists group_members_status_check;
alter table public.group_members add constraint group_members_status_check
  check (status in ('active', 'pending', 'left', 'removed'));

create index if not exists idx_groups_type on public.groups(type);
create index if not exists idx_groups_host_id on public.groups(host_id);
create index if not exists idx_groups_listing_id on public.groups(listing_id);
create index if not exists idx_groups_is_archived on public.groups(is_archived);
create index if not exists idx_group_members_is_host on public.group_members(is_host);
