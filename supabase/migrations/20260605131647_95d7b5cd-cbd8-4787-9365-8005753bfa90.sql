CREATE TABLE public.calendar_feed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feed_tokens TO authenticated;
GRANT ALL ON public.calendar_feed_tokens TO service_role;

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view calendar feed tokens"
  ON public.calendar_feed_tokens FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert calendar feed tokens"
  ON public.calendar_feed_tokens FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update calendar feed tokens"
  ON public.calendar_feed_tokens FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete calendar feed tokens"
  ON public.calendar_feed_tokens FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));