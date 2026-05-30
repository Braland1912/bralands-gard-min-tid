-- Dela upp duschpunkten och lägg till tre nya punkter i kvällsrundans checklista
UPDATE public.checklist_template_items
SET text = 'Plocka isär och rengör vattenlåsen i lilla duschen', sort_order = 1
WHERE id = '2fd9e170-6eb4-4fcc-8e60-dca5f87aa408';

INSERT INTO public.checklist_template_items (template_id, text, sort_order) VALUES
  ('60020f44-e65d-47e8-97c3-02e35463cf2d', 'Plocka isär och rengör vattenlåsen i stora duschen', 2);

-- Skjut befintliga efterföljande punkter framåt
UPDATE public.checklist_template_items SET sort_order = 3 WHERE id = 'b0ecfd26-538d-4e9c-a560-2533b6d2995c';
UPDATE public.checklist_template_items SET sort_order = 4 WHERE id = '92980dbc-b63a-4182-bdc3-77e172c64446';
UPDATE public.checklist_template_items SET sort_order = 5 WHERE id = '02e3426e-cfab-4d5c-a9f6-1df9b8415adb';

-- Lägg till de tre nya punkterna i botten
INSERT INTO public.checklist_template_items (template_id, text, sort_order) VALUES
  ('60020f44-e65d-47e8-97c3-02e35463cf2d', 'Töm sopor utanför kiosken', 6),
  ('60020f44-e65d-47e8-97c3-02e35463cf2d', 'Töm sopor bakom servicehuset', 7),
  ('60020f44-e65d-47e8-97c3-02e35463cf2d', 'Stänga fönster och dörrar', 8);