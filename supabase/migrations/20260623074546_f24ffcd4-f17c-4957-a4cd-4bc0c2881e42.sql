ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS can_see_lodge boolean NOT NULL DEFAULT false;