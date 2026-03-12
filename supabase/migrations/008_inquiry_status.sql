alter table public.groups add column if not exists inquiry_status text
  check (inquiry_status in ('pending', 'accepted', 'declined')) default 'pending';

alter table public.groups add column if not exists address_revealed boolean default false;

create index if not exists idx_groups_inquiry_status on public.groups(inquiry_status);

create policy "Hosts can update their inquiry groups"
  on public.groups for update
  using (auth.uid() = host_id AND type = 'listing_inquiry');
