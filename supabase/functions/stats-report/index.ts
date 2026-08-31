import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const PAYMENT_LABELS: Record<string, string> = {
  S: "Swish",
  P: "Kontant",
  Cp: "Kortläsare (plats)",
  Cc: "Kortläsare (camping)",
  R: "Faktura",
  B: "Bankgiro",
  K: "Kiosk/kortterminal",
  Z: "Förbetald (bokning)",
};

const NAT_LABELS: Record<string, string> = {
  SE: "Sverige", NO: "Norge", DK: "Danmark", FI: "Finland", DE: "Tyskland",
  NL: "Nederländerna", BE: "Belgien", FR: "Frankrike", CH: "Schweiz", AT: "Österrike",
  GB: "Storbritannien", PL: "Polen", IT: "Italien", ES: "Spanien", CZ: "Tjeckien",
  US: "USA", EE: "Estland", LV: "Lettland", LT: "Litauen",
};

const CAT_LABELS: Record<string, string> = {
  kiosk: "Kiosk",
  ved: "Ved",
  tvattmaskin: "Tvättmaskin",
  torktumlare: "Torktumlare",
  other: "Övrigt",
};

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: t.getUTCFullYear(), week };
}

async function isAdminRequest(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !!role;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function checkPassword(pw: string | undefined): Promise<boolean> {
  if (!pw) return false;
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "stats_share_password")
    .maybeSingle();
  const stored = (data?.value as any)?.password_sha256;
  if (!stored) return false;
  return String(stored).toLowerCase() === (await sha256(pw));
}

async function buildReport() {
  const { data: guests, error: gErr } = await admin
    .from("evening_round_guests")
    .select(
      "id, guest_name, arrival_date, departure_date, status, payment_method, payment_amount, payment_currency, payment_other_note, nationality, place_label, accommodation_type, tent_persons, is_prepaid, evening_round_id",
    );
  if (gErr) throw gErr;

  const { data: rounds } = await admin
    .from("evening_rounds")
    .select("id, round_date, assigned_worker_id");
  const { data: workers } = await admin.from("workers").select("id, name");
  const { data: summaries } = await admin
    .from("evening_round_summaries")
    .select("id, evening_round_id, worker_id, cash_breakdown, created_at");

  const workerName = new Map((workers ?? []).map((w: any) => [w.id, w.name]));
  const roundById = new Map((rounds ?? []).map((r: any) => [r.id, r]));

  // ---- Per dag ----
  type Day = {
    date: string;
    nights: number;
    nightsHere: number;
    arrivals: number;
    departures: number;
    revenueSEK: number;
    revenueEUR: number;
  };
  const days = new Map<string, Day>();
  const getDay = (d: string): Day => {
    let x = days.get(d);
    if (!x) {
      x = { date: d, nights: 0, nightsHere: 0, arrivals: 0, departures: 0, revenueSEK: 0, revenueEUR: 0 };
      days.set(d, x);
    }
    return x;
  };

  let totalNights = 0;
  let totalNightsHere = 0;
  let revenueSEK = 0;
  let revenueEUR = 0;

  const natMap = new Map<string, { bookings: number; nights: number }>();
  const payMap = new Map<string, { count: number; sek: number; eur: number }>();
  const accMap = new Map<string, number>();

  for (const g of guests ?? []) {
    const a = toDate(g.arrival_date);
    const dep = toDate(g.departure_date);
    let n = Math.round((dep.getTime() - a.getTime()) / 86400000);
    if (n < 1) n = 1;
    totalNights += n;
    if (g.status === "here") totalNightsHere += n;

    for (let i = 0; i < n; i++) {
      const d = new Date(a.getTime() + i * 86400000);
      const rec = getDay(fmt(d));
      rec.nights += 1;
      if (g.status === "here") rec.nightsHere += 1;
    }
    getDay(g.arrival_date).arrivals += 1;
    getDay(g.departure_date).departures += 1;

    const amount = Number(g.payment_amount ?? 0);
    const cur = (g.payment_currency ?? "SEK").toUpperCase();
    if (cur === "EUR") {
      revenueEUR += amount;
      getDay(g.arrival_date).revenueEUR += amount;
    } else {
      revenueSEK += amount;
      getDay(g.arrival_date).revenueSEK += amount;
    }

    const nat = g.nationality || "—";
    const nm = natMap.get(nat) ?? { bookings: 0, nights: 0 };
    nm.bookings += 1;
    nm.nights += n;
    natMap.set(nat, nm);

    const pmKey = g.payment_method ?? "—";
    const pm = payMap.get(pmKey) ?? { count: 0, sek: 0, eur: 0 };
    pm.count += 1;
    if (cur === "EUR") pm.eur += amount;
    else pm.sek += amount;
    payMap.set(pmKey, pm);

    accMap.set(g.accommodation_type, (accMap.get(g.accommodation_type) ?? 0) + 1);
  }

  const dailyAll = Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
  const daily = dailyAll.filter((d) => d.nights > 0 || d.arrivals > 0 || d.departures > 0);

  // ---- Per vecka ----
  const weekMap = new Map<
    string,
    { week: number; year: number; from: string; to: string; nights: number; arrivals: number; revenueSEK: number; revenueEUR: number; days: number }
  >();
  for (const d of daily) {
    const { year, week } = isoWeek(toDate(d.date));
    const key = `${year}-${String(week).padStart(2, "0")}`;
    let w = weekMap.get(key);
    if (!w) {
      w = { week, year, from: d.date, to: d.date, nights: 0, arrivals: 0, revenueSEK: 0, revenueEUR: 0, days: 0 };
      weekMap.set(key, w);
    }
    if (d.date < w.from) w.from = d.date;
    if (d.date > w.to) w.to = d.date;
    w.nights += d.nights;
    w.arrivals += d.arrivals;
    w.revenueSEK += d.revenueSEK;
    w.revenueEUR += d.revenueEUR;
    w.days += 1;
  }
  const weekly = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, w]) => ({ ...w, avgPerNight: w.days ? w.nights / w.days : 0 }));

  // ---- Per månad ----
  const monthMap = new Map<string, { month: string; nights: number; arrivals: number; revenueSEK: number; days: number }>();
  for (const d of daily) {
    const key = d.date.slice(0, 7);
    let m = monthMap.get(key);
    if (!m) {
      m = { month: key, nights: 0, arrivals: 0, revenueSEK: 0, days: 0 };
      monthMap.set(key, m);
    }
    m.nights += d.nights;
    m.arrivals += d.arrivals;
    m.revenueSEK += d.revenueSEK;
    m.days += 1;
  }
  const monthly = Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, avgPerNight: m.days ? m.nights / m.days : 0 }));

  // ---- Medarbetare ----
  const wStats = new Map<
    string,
    { name: string; rounds: number; roundDates: string[]; summaries: number; kioskItems: number; kioskAmount: number; cardPayments: number; guestsRegistered: number; revenueSEK: number }
  >();
  const getW = (id: string) => {
    let w = wStats.get(id);
    if (!w) {
      w = {
        name: workerName.get(id) ?? "Okänd",
        rounds: 0,
        roundDates: [],
        summaries: 0,
        kioskItems: 0,
        kioskAmount: 0,
        cardPayments: 0,
        guestsRegistered: 0,
        revenueSEK: 0,
      };
      wStats.set(id, w);
    }
    return w;
  };

  for (const r of rounds ?? []) {
    const w = getW(r.assigned_worker_id);
    w.rounds += 1;
    w.roundDates.push(r.round_date);
  }

  for (const g of guests ?? []) {
    const r = roundById.get(g.evening_round_id);
    if (!r) continue;
    const w = getW(r.assigned_worker_id);
    w.guestsRegistered += 1;
    if (g.payment_method === "Cp" || g.payment_method === "Cc") w.cardPayments += 1;
    if ((g.payment_currency ?? "SEK").toUpperCase() !== "EUR") w.revenueSEK += Number(g.payment_amount ?? 0);
  }

  // ---- Kiosk / ekonomiredovisning ----
  const kioskEntries: {
    date: string;
    worker: string;
    category: string;
    note: string;
    quantity: number;
    amount: number;
    currency: string;
  }[] = [];
  const catTotals = new Map<string, { count: number; amount: number }>();

  for (const s of summaries ?? []) {
    const w = getW(s.worker_id);
    w.summaries += 1;
    const round = roundById.get(s.evening_round_id);
    const date = round?.round_date ?? String(s.created_at).slice(0, 10);
    const cb = (s.cash_breakdown ?? {}) as Record<string, any[]>;
    for (const [cat, items] of Object.entries(cb)) {
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const amount = Number(it?.amount ?? 0);
        const quantity = Number(it?.quantity ?? 0);
        if (!amount && !quantity && !it?.notes) continue;
        kioskEntries.push({
          date,
          worker: w.name,
          category: CAT_LABELS[cat] ?? cat,
          note: String(it?.notes ?? ""),
          quantity,
          amount,
          currency: String(it?.currency ?? "SEK"),
        });
        const t = catTotals.get(cat) ?? { count: 0, amount: 0 };
        t.count += 1;
        t.amount += amount;
        catTotals.set(cat, t);
        if (cat === "kiosk") {
          w.kioskItems += 1;
          w.kioskAmount += amount;
        }
      }
    }
  }
  kioskEntries.sort((a, b) => a.date.localeCompare(b.date));

  const workersStats = Array.from(wStats.values())
    .filter((w) => w.rounds > 0 || w.summaries > 0)
    .map((w) => ({ ...w, roundDates: w.roundDates.sort() }))
    .sort((a, b) => b.rounds - a.rounds);

  const topNight = daily.reduce((best, d) => (d.nights > (best?.nights ?? 0) ? d : best), daily[0]);
  const activeDays = daily.filter((d) => d.nights > 0).length;

  return {
    generatedAt: new Date().toISOString(),
    season: {
      from: daily[0]?.date ?? null,
      to: daily[daily.length - 1]?.date ?? null,
    },
    kpis: {
      bookings: (guests ?? []).length,
      totalNights,
      totalNightsHere,
      avgPerNight: activeDays ? totalNights / activeDays : 0,
      activeDays,
      topNightDate: topNight?.date ?? null,
      topNightNights: topNight?.nights ?? 0,
      revenueSEK,
      revenueEUR,
      rounds: (rounds ?? []).length,
      summaries: (summaries ?? []).length,
    },
    daily,
    weekly,
    monthly,
    nationalities: Array.from(natMap.entries())
      .map(([code, v]) => ({ code, label: NAT_LABELS[code] ?? (code === "—" ? "Ej angiven" : code), ...v }))
      .sort((a, b) => b.nights - a.nights),
    payments: Array.from(payMap.entries())
      .map(([code, v]) => ({ code, label: PAYMENT_LABELS[code] ?? (code === "—" ? "Ej angivet" : code), ...v }))
      .sort((a, b) => b.count - a.count),
    accommodation: Array.from(accMap.entries()).map(([type, count]) => ({ type, count })),
    workers: workersStats,
    kiosk: {
      entries: kioskEntries,
      totals: Array.from(catTotals.entries()).map(([cat, t]) => ({
        category: CAT_LABELS[cat] ?? cat,
        count: t.count,
        amount: t.amount,
      })),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    const allowed = (await isAdminRequest(req)) || (await checkPassword(body?.password));
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Fel lösenord" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report = await buildReport();
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stats-report error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
