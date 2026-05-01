-- App settings (key/value)
CREATE TABLE public.app_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read app settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage app settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed: Kvällsrunda-mall + 5 punkter + sätt som default
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  INSERT INTO public.checklist_templates (name, sort_order)
  VALUES ('Kvällsrunda', 0)
  RETURNING id INTO v_template_id;

  INSERT INTO public.checklist_template_items (template_id, text, sort_order) VALUES
    (v_template_id, 'Torka av under båda kylarna i kiosken', 0),
    (v_template_id, 'Plocka isär och rengör båda vattenlåsen i båda duscharna', 1),
    (v_template_id, 'Töm vatten och filter i torktumlare servicehuset', 2),
    (v_template_id, 'Töm filter i torktumlare tvättstugan', 3),
    (v_template_id, 'Kolla tvättmaskin och torktumlare (torr tvätt)', 4);

  INSERT INTO public.app_settings (key, value)
  VALUES ('evening_round_checklist_template_id', to_jsonb(v_template_id::text));
END $$;