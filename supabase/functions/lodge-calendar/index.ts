import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ICAL_URL =
  "https://p58-caldav.icloud.com/published/2/MTA1ODE3MDcxOTEwNTgxN91kGTRe8a_Uy0sDJP251UH6vfgMWKkQ_id0JFYTNSbGsJO7HlWwf5euy9-z7EiuL-AKUySVr4pgJaeyHbdikC0";

// Enkel in-memory-cache (per warm instance)
let cache: { fetchedAt: number; events: ParsedEvent[] } | null = null;
const CACHE_MS = 5 * 60 * 1000; // 5 min

type ParsedEvent = {
  uid: string;
  summary: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusive, ICS-standard)
  allDay: boolean;
  startTime?: string; // HH:MM
  endTime?: string;
  unit: string;
};

// Mappning av nyckelord -> uthyrningsenhet (de fem uthyrningsbara enheterna)
const UNIT_KEYWORDS: { unit: string; words: string[] }[] = [
  { unit: "Öringen", words: ["öringen", "oringen"] },
  { unit: "Laxen", words: ["laxen", "lax "] },
  { unit: "Kungsfiskaren", words: ["kungsfiskaren", "kungsfiskare"] },
  { unit: "Strömstaren", words: ["strömstaren", "stromstaren", "strömstare", "stromstare"] },
  { unit: "Husvagnen", words: ["husvagnen", "husvagn", "husbil", "camping"] },
];

function detectUnit(summary: string): string {
  const s = summary.toLowerCase();
  for (const { unit, words } of UNIT_KEYWORDS) {
    if (words.some((w) => s.includes(w))) return unit;
  }
  return "Övrigt";
}

function unfold(ics: string): string[] {
  // ICS line folding: rader som börjar med space/tab fortsätter förra raden
  const raw = ics.split(/\r?\n/);
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescape(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseDateValue(raw: string): { date: string; time?: string; allDay: boolean } {
  // Tar in "20260807" eller "20260807T091500" (eventuellt med Z)
  const clean = raw.replace(/[Z]/g, "");
  const datePart = clean.slice(0, 8);
  const date = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  if (clean.length >= 11 && clean[8] === "T") {
    const t = clean.slice(9);
    const time = `${t.slice(0, 2)}:${t.slice(2, 4)}`;
    return { date, time, allDay: false };
  }
  return { date, allDay: true };
}

function parseICS(ics: string): ParsedEvent[] {
  const lines = unfold(ics);
  const events: ParsedEvent[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.DTSTART && current.SUMMARY) {
        const start = parseDateValue(current.DTSTART);
        const endRaw = current.DTEND ?? current.DTSTART;
        const end = parseDateValue(endRaw);
        const summary = unescape(current.SUMMARY).trim();
        events.push({
          uid: current.UID ?? crypto.randomUUID(),
          summary,
          start: start.date,
          end: end.date,
          allDay: start.allDay,
          startTime: start.time,
          endTime: end.time,
          unit: detectUnit(summary),
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    // Hitta nyckel (kan ha parametrar t.ex. DTSTART;VALUE=DATE:...)
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const key = left.split(";")[0];
    if (["UID", "SUMMARY", "DTSTART", "DTEND", "DESCRIPTION", "LOCATION"].includes(key)) {
      current[key] = value;
    }
  }

  return events;
}

async function getEvents(forceRefresh = false): Promise<ParsedEvent[]> {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_MS) {
    return cache.events;
  }
  const res = await fetch(ICAL_URL, { headers: { Accept: "text/calendar" } });
  if (!res.ok) {
    if (cache) return cache.events; // fallback
    throw new Error(`Kunde inte hämta kalendern (${res.status})`);
  }
  const text = await res.text();
  // Endast händelser som tydligt tillhör en av de fyra uthyrningsenheterna
  const events = parseICS(text).filter((e) => e.unit !== "Övrigt");
  cache = { fetchedAt: now, events };
  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Ej inloggad" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Ogiltig session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Behörighetskoll: admin ELLER worker.can_see_lodge = true
    const [{ data: roleRow }, { data: workerRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabase.from("workers").select("can_see_lodge").eq("user_id", userId).maybeSingle(),
    ]);

    const allowed = !!roleRow || workerRow?.can_see_lodge === true;
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Saknar behörighet" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const events = await getEvents(forceRefresh);

    return new Response(
      JSON.stringify({ events, fetchedAt: cache?.fetchedAt ?? Date.now() }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (e) {
    console.error("lodge-calendar error", e);
    return new Response(JSON.stringify({ error: "Internt fel" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
