CREATE TABLE public.statistics_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL,
 messages jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.statistics_conversations TO service_role;
REVOKE ALL ON public.statistics_conversations FROM anon, authenticated;
ALTER TABLE public.statistics_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX statistics_conversations_updated_idx ON public.statistics_conversations (updated_at DESC);