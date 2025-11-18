-- Create workers table
CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Create time_entries table
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
  worker_name text NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Public read access for workers (needed for clock in/out)
CREATE POLICY "Anyone can view workers"
  ON public.workers FOR SELECT
  USING (true);

-- Public insert/update access for time_entries (needed for clock in/out)
CREATE POLICY "Anyone can insert time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view time entries"
  ON public.time_entries FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update time entries"
  ON public.time_entries FOR UPDATE
  USING (true);

-- Insert sample workers
INSERT INTO public.workers (name) VALUES 
  ('Emma Johnson'),
  ('Lucas Smith'),
  ('Sophia Brown'),
  ('Noah Davis'),
  ('Olivia Wilson'),
  ('Liam Martinez'),
  ('Ava Garcia'),
  ('Mason Rodriguez');

-- Create index for faster queries
CREATE INDEX idx_time_entries_worker_id ON public.time_entries(worker_id);
CREATE INDEX idx_time_entries_created_at ON public.time_entries(created_at);