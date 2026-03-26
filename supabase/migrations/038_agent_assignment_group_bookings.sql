-- Part 1: Add assigned_agent_id to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.users(id);

-- Part 6: Add group_id to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id);
