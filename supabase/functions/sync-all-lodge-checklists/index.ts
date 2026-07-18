import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ICAL_URL =
  "https://p58-caldav.icloud.com/published/2/MTA1ODE3MDcxOTEwNTgxN91kGTRe8a_Uy0sDJP251UH6vfgMWKkQ_id0JFYTNSbGsJO7HlWwf5euy9-z7EiuL-AKUySVr4pgJaeyHbdikC0";

const UNIT_ORDER = ["Öringen", "Laxen", "Kungsfiskaren", "Strömstaren", "Husvagnen"] as const;
type LodgeUnit = (typeof UNIT_ORDER)[number];

type ParsedEvent = { uid: string; summary: string; start: string; end: string; unit: string };
type Group = { id: string; name: string; color: string | null; sort_order: number; lodge_unit: string | null };
type Template = { id: string; name: string; lodge_unit: string | null; description: string | null; group_id: string | null; sort_order: number; effective_lodge_unit?: string | null };
type TemplateItem = { id: string; template_id: string; text: string; sort_order: number; description: string | null };

function unfold(ics: string): string[] {
  const raw = ics.split(/\r?\n/); const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}
function unescapeText(t: string) { return t.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"); }
function detectUnit(summary: string): string {
  const s = summary.toLowerCase();
  if (s.includes("öringen") || s.includes("oringen")) return "Öringen";
  if (s.includes("laxen") || s.includes("lax ")) return "Laxen";
  if (s.includes("kungsfiskaren") || s.includes("kungsfiskare")) return "Kungsfiskaren";
  if (s.includes("strömstaren") || s.includes("stromstaren") || s.includes("strömstare") || s.includes("stromstare")) return "Strömstaren";
  if (s.includes("husvagnen") || s.includes("husvagn") || s.includes("husbil") || s.includes("camping")) return "Husvagnen";
  return "Övrigt";
}
function parseDateValue(raw: string): string {
  const clean = raw.replace(/[Z]/g, ""); const d = clean.slice(0, 8);
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}
function parseICS(ics: string): ParsedEvent[] {
  const lines = unfold(ics); const events: ParsedEvent[] = []; let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur?.DTSTART && cur.SUMMARY) {
        const summary = unescapeText(cur.SUMMARY).trim();
        events.push({ uid: cur.UID ?? crypto.randomUUID(), summary, start: parseDateValue(cur.DTSTART), end: parseDateValue(cur.DTEND ?? cur.DTSTART), unit: detectUnit(summary) });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const c = line.indexOf(":"); if (c === -1) continue;
    const key = line.slice(0, c).split(";")[0];
    if (["UID","SUMMARY","DTSTART","DTEND"].includes(key)) cur[key] = line.slice(c + 1);
  }
  return events.filter(e => e.unit !== "Övrigt");
}
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`;
}
function departingUnitsForDate(events: ParsedEvent[], dateISO: string): LodgeUnit[] {
  const units = new Set<string>();
  for (const e of events) if (addDaysISO(e.end, -1) === dateISO && e.start !== dateISO) units.add(e.unit);
  return UNIT_ORDER.filter(u => units.has(u));
}
function isClosingGroup(name: string | null) {
  const n = (name ?? "").toLowerCase(); return n.includes("avlutning") || n.includes("avslutning");
}

async function syncShift(admin: any, shift: { id: string; date: string; shift_type: string }, events: ParsedEvent[]) {
  const existingRes = await admin.from("shift_checklists").select("id, shift_id, name, description, group_name, group_color, lodge_unit, sort_order").eq("shift_id", shift.id);
  if (existingRes.error) throw existingRes.error;
  const existingLists = existingRes.data ?? [];
  let changed = false;

  if (shift.shift_type !== "day") {
    const toRemove = existingLists.filter((l: any) => l.lodge_unit).map((l: any) => l.id);
    if (toRemove.length > 0) { await admin.from("shift_checklists").delete().in("id", toRemove); changed = true; }
    return { changed, wantedUnits: [] };
  }

  const wantedUnits = departingUnitsForDate(events, shift.date);
  const wantedSet = new Set<string>(wantedUnits);

  const removeIds = existingLists.filter((l: any) => l.lodge_unit && !wantedSet.has(l.lodge_unit)).map((l: any) => l.id);
  if (removeIds.length > 0) { const { error } = await admin.from("shift_checklists").delete().in("id", removeIds); if (error) throw error; changed = true; }

  if (wantedUnits.length > 0) {
    const { data: lodgeGroups, error: groupsErr } = await admin.from("checklist_template_groups").select("id, name, color, sort_order, lodge_unit").in("lodge_unit", wantedUnits);
    if (groupsErr) throw groupsErr;
    const groups = (lodgeGroups ?? []) as Group[];
    const groupById = new Map(groups.map(g => [g.id, g]));
    const groupUnitById = new Map(groups.map(g => [g.id, g.lodge_unit]));
    const groupIds = groups.map(g => g.id);

    const directRes = await admin.from("checklist_templates").select("id, name, lodge_unit, description, group_id, sort_order").in("lodge_unit", wantedUnits);
    if (directRes.error) throw directRes.error;

    let groupTemplates: Template[] = [];
    if (groupIds.length > 0) {
      const gtr = await admin.from("checklist_templates").select("id, name, lodge_unit, description, group_id, sort_order").in("group_id", groupIds);
      if (gtr.error) throw gtr.error;
      groupTemplates = (gtr.data ?? []) as Template[];
    }

    const byId = new Map<string, Template>();
    for (const t of ((directRes.data ?? []) as Template[])) byId.set(t.id, { ...t, effective_lodge_unit: t.lodge_unit });
    for (const t of groupTemplates) {
      const effective = t.lodge_unit ?? groupUnitById.get(t.group_id ?? "") ?? null;
      if (effective && wantedSet.has(effective)) byId.set(t.id, { ...t, effective_lodge_unit: effective });
    }
    const templates = Array.from(byId.values()).sort((a, b) => {
      const au = UNIT_ORDER.indexOf(a.effective_lodge_unit as LodgeUnit);
      const bu = UNIT_ORDER.indexOf(b.effective_lodge_unit as LodgeUnit);
      if (au !== bu) return au - bu;
      const ag = groupById.get(a.group_id ?? "")?.sort_order ?? 999;
      const bg = groupById.get(b.group_id ?? "")?.sort_order ?? 999;
      if (ag !== bg) return ag - bg;
      return a.sort_order - b.sort_order;
    });

    const tplIds = templates.map(t => t.id);
    let templateItems: TemplateItem[] = [];
    if (tplIds.length > 0) {
      const itr = await admin.from("checklist_template_items").select("id, template_id, text, sort_order, description").in("template_id", tplIds).order("sort_order", { ascending: true });
      if (itr.error) throw itr.error;
      templateItems = (itr.data ?? []) as TemplateItem[];
    }

    const latestRes = await admin.from("shift_checklists").select("id, shift_id, name, description, group_name, group_color, lodge_unit, sort_order").eq("shift_id", shift.id);
    if (latestRes.error) throw latestRes.error;
    const existingByName = new Map<string, any>((latestRes.data ?? []).map((l: any) => [l.name, l]));

    for (const tpl of templates) {
      const unit = tpl.effective_lodge_unit; if (!unit || !wantedSet.has(unit)) continue;
      const grp = groupById.get(tpl.group_id ?? "") ?? null;
      let checklist = existingByName.get(tpl.name);
      const payload = { lodge_unit: unit, description: tpl.description ?? null, group_name: grp?.name ?? null, group_color: grp?.color ?? null };
      if (checklist) {
        const needs = checklist.lodge_unit !== payload.lodge_unit || checklist.description !== payload.description || checklist.group_name !== payload.group_name || checklist.group_color !== payload.group_color;
        if (needs) { const { error } = await admin.from("shift_checklists").update(payload).eq("id", checklist.id); if (error) throw error; checklist = { ...checklist, ...payload }; changed = true; }
      } else {
        const { data: created, error } = await admin.from("shift_checklists").insert({ shift_id: shift.id, name: tpl.name, sort_order: 10_000, ...payload }).select("id, name").single();
        if (error) throw error; checklist = created; existingByName.set(tpl.name, checklist); changed = true;
      }
      const desired = templateItems.filter(it => it.template_id === tpl.id).sort((a, b) => a.sort_order - b.sort_order);
      const { data: currentItems, error: ciErr } = await admin.from("shift_checklist_items").select("id, text, sort_order, description, is_checked").eq("shift_checklist_id", checklist.id).order("sort_order", { ascending: true });
      if (ciErr) throw ciErr;
      const used = new Set<string>();
      for (let i = 0; i < desired.length; i++) {
        const d = desired[i];
        let m = (currentItems ?? []).find((it: any) => !used.has(it.id) && it.text === d.text);
        if (!m) m = (currentItems ?? []).find((it: any) => !used.has(it.id) && it.sort_order === i);
        if (m) {
          used.add(m.id);
          const p = { text: d.text, description: d.description ?? null, sort_order: i };
          if (m.text !== p.text || m.description !== p.description || m.sort_order !== p.sort_order) { const { error } = await admin.from("shift_checklist_items").update(p).eq("id", m.id); if (error) throw error; changed = true; }
        } else {
          const { error } = await admin.from("shift_checklist_items").insert({ shift_checklist_id: checklist.id, text: d.text, description: d.description ?? null, sort_order: i });
          if (error) throw error; changed = true;
        }
      }
      const stale = (currentItems ?? []).filter((it: any) => !used.has(it.id)).map((it: any) => it.id);
      if (stale.length > 0) { const { error } = await admin.from("shift_checklist_items").delete().in("id", stale); if (error) throw error; changed = true; }
    }
  }

  const finalRes = await admin.from("shift_checklists").select("id, group_name, lodge_unit, sort_order").eq("shift_id", shift.id).order("sort_order", { ascending: true });
  if (finalRes.error) throw finalRes.error;
  const finalLists = finalRes.data ?? [];
  const groupRank = new Map<string, number>();
  let nextRegular = 0;
  for (const l of finalLists as any[]) {
    const key = l.group_name ?? "__none__";
    if (groupRank.has(key)) continue;
    if (l.lodge_unit) groupRank.set(key, 700 + UNIT_ORDER.indexOf(l.lodge_unit as LodgeUnit));
    else if (isClosingGroup(l.group_name)) groupRank.set(key, 900);
    else groupRank.set(key, nextRegular++);
  }
  const ordered = [...(finalLists as any[])].sort((a, b) => {
    const ar = groupRank.get(a.group_name ?? "__none__") ?? 500;
    const br = groupRank.get(b.group_name ?? "__none__") ?? 500;
    if (ar !== br) return ar - br;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].sort_order === i) continue;
    const { error } = await admin.from("shift_checklists").update({ sort_order: i }).eq("id", ordered[i].id); if (error) throw error; changed = true;
  }

  return { changed, wantedUnits };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const events = await getEventsFromICS();

    const { data: shifts, error } = await admin
      .from("schedules")
      .select("id, date, shift_type")
      .eq("shift_type", "day")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: true });
    if (error) throw error;

    const results: any[] = [];
    for (const s of shifts ?? []) {
      try {
        const r = await syncShift(admin, s as any, events);
        results.push({ id: s.id, date: s.date, ...r });
      } catch (e) {
        results.push({ id: s.id, date: s.date, error: String(e) });
      }
    }

    const changedCount = results.filter(r => r.changed).length;
    return new Response(JSON.stringify({ total: results.length, changedCount, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-all-lodge-checklists error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function getEventsFromICS(): Promise<ParsedEvent[]> {
  const res = await fetch(ICAL_URL, { headers: { Accept: "text/calendar" } });
  if (!res.ok) throw new Error(`Kunde inte hämta kalendern (${res.status})`);
  return parseICS(await res.text());
}
