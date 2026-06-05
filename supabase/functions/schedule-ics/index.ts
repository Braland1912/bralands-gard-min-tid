import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SHIFT_MAP: Record<string, { emoji: string; label: string; time?: string }> = {
  morning: { emoji: "🌅", label: "Morgon", time: "07:00" },
  day: { emoji: "☀️", label: "Dag", time: "11:00" },
  evening: { emoji: "🌙", label: "Kväll", time: "17:00" },
  fishing: { emoji: "🎣", label: "Guidning" }, // heldag
  clearing: { emoji: "🚜", label: "Gården" }, // heldag
};

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateOnly(dateStr: string): string {
  // dateStr = "YYYY-MM-DD" -> "YYYYMMDD"
  return dateStr.replace(/-/g, "");
}

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function formatLocalDateTime(dateStr: string, time: string): string {
  // floating local time, no Z
  const [h, mi] = time.split(":").map(Number);
  return `${formatDateOnly(dateStr)}T${pad(h)}${pad(mi)}00`;
}

function addHourLocal(dateStr: string, time: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h + 1, mi);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

function nowUtcStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokenRow, error: tokenErr } = await supabase
      .from("calendar_feed_tokens")
      .select("id, revoked, user_id")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow || tokenRow.revoked) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }

    const from = todayMinus(30);
    const to = todayPlus(180);

    let schedQuery = supabase
      .from("schedules")
      .select("id, date, shift_type, shift_index, user_id")
      .gte("date", from)
      .lte("date", to);

    if (tokenRow.user_id) {
      schedQuery = schedQuery.eq("user_id", tokenRow.user_id);
    }

    const { data: schedules, error: schedErr } = await schedQuery;


    if (schedErr) {
      return new Response("Error", { status: 500, headers: corsHeaders });
    }

    const { data: workers } = await supabase
      .from("workers")
      .select("user_id, name");

    const nameByUser = new Map<string, string>();
    (workers ?? []).forEach((w: any) => {
      if (w.user_id) nameByUser.set(w.user_id, w.name);
    });

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bralands Gard//Bralandsklockan//SV",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Brålands schema",
      "X-WR-TIMEZONE:Europe/Stockholm",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
    ];

    const dtstamp = nowUtcStamp();

    for (const s of schedules ?? []) {
      const meta = SHIFT_MAP[s.shift_type];
      if (!meta) continue; // skip busy/off and unknown
      const name = nameByUser.get(s.user_id) ?? "Okänd";
      const summary = escapeIcs(`${name} – ${meta.emoji} ${meta.label}`);
      const uid = `${s.id}@bralandsklockan`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`SUMMARY:${summary}`);

      if (meta.time) {
        lines.push(`DTSTART:${formatLocalDateTime(s.date, meta.time)}`);
        lines.push(`DTEND:${addHourLocal(s.date, meta.time)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(s.date)}`);
        lines.push(`DTEND;VALUE=DATE:${addOneDay(s.date)}`);
      }

      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const body = lines.join("\r\n") + "\r\n";

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="bralands-schema.ics"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (_e) {
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
