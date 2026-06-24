import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, parseISO, isWithinInterval } from "date-fns";

export type LodgeEvent = {
  uid: string;
  summary: string;
  start: string; // ISO date "YYYY-MM-DD"
  end: string; // ISO date, exclusive
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  unit: string;
};

export type LodgeUnit =
  | "Öringen"
  | "Laxen"
  | "Kungsfiskaren"
  | "Strömstaren"
  | "Husvagnen";

export const UNIT_ORDER: LodgeUnit[] = [
  "Öringen",
  "Laxen",
  "Kungsfiskaren",
  "Strömstaren",
  "Husvagnen",
];

export const UNIT_NUMBER: Record<string, string> = {
  "Öringen": "Nr. 1",
  "Laxen": "Nr. 2",
  "Kungsfiskaren": "Nr. 3",
  "Strömstaren": "Nr. 4",
  "Husvagnen": "Nr. 5",
};

export const UNIT_STYLES: Record<string, { dot: string; chip: string }> = {
  "Öringen":       { dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-800 border-amber-200" },
  "Laxen":         { dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-800 border-rose-200" },
  "Kungsfiskaren": { dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-800 border-sky-200" },
  "Strömstaren":   { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  "Husvagnen":     { dot: "bg-violet-500",  chip: "bg-violet-50 text-violet-800 border-violet-200" },
};

export const styleFor = (unit: string) =>
  UNIT_STYLES[unit] ?? { dot: "bg-gray-400", chip: "bg-gray-50 text-gray-700 border-gray-200" };

export type Role = "start" | "middle" | "end" | "single";

export const roleForDay = (e: LodgeEvent, day: Date): Role | null => {
  const start = parseISO(e.start);
  const endInclusive = addDays(parseISO(e.end), -1);
  const last = endInclusive < start ? start : endInclusive;
  if (!isWithinInterval(day, { start, end: last })) return null;
  const isStart = day.getTime() === start.getTime();
  const isEnd = day.getTime() === last.getTime();
  if (isStart && isEnd) return "single";
  if (isStart) return "start";
  if (isEnd) return "end";
  return "middle";
};

export const useLodgeEvents = () =>
  useQuery({
    queryKey: ["lodge-calendar"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ej inloggad");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lodge-calendar`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ events: LodgeEvent[] }>;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

/** Returnerar enheter med olika roller för en specifik dag. */
export const splitByRole = (events: LodgeEvent[], day: Date) => {
  const startOfDay = new Date(day);
  startOfDay.setHours(0, 0, 0, 0);
  const dayEvents = events.filter((e) => roleForDay(e, startOfDay) !== null);
  const arrivals = dayEvents.filter((e) => {
    const r = roleForDay(e, startOfDay);
    return r === "start" || r === "single";
  });
  const departures = dayEvents.filter((e) => roleForDay(e, startOfDay) === "end");
  const ongoing = dayEvents.filter((e) => roleForDay(e, startOfDay) === "middle");
  const busyUnits = new Set(dayEvents.map((e) => e.unit));
  const potentialUnits = UNIT_ORDER.filter((u) => !busyUnits.has(u));
  return { arrivals, departures, ongoing, potentialUnits, dayEvents };
};

/** Enheter som har AVFÄRD (bytesdag) på given dag. */
export const departingUnitsForDate = (
  events: LodgeEvent[],
  dateISO: string,
): LodgeUnit[] => {
  const day = parseISO(dateISO);
  day.setHours(0, 0, 0, 0);
  const { departures } = splitByRole(events, day);
  const units = new Set<string>();
  for (const e of departures) units.add(e.unit);
  return UNIT_ORDER.filter((u) => units.has(u));
};
