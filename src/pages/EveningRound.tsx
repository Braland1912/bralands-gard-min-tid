import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Shield, AlertTriangle, Calendar, ChevronLeft, ChevronRight, Play, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useWorker } from "@/hooks/useWorker";
import { useEveningRound } from "@/hooks/useEveningRound";
import {
  useEveningRoundGuests,
  type EveningRoundGuest,
  type GuestInput,
  type GuestStatus,
} from "@/hooks/useEveningRoundGuests";
import {
  useEveningRoundSession,
  useEveningRoundSessionsForDate,
} from "@/hooks/useEveningRoundSession";
import EveningRoundCard from "@/components/EveningRoundCard";
import EveningRoundModal from "@/components/EveningRoundModal";
import EveningRoundExportDialog from "@/components/EveningRoundExportDialog";
import QuickReserveCard from "@/components/QuickReserveCard";
import EveningRoundCreateDialog from "@/components/EveningRoundCreateDialog";
import MemberMobileBottomNav from "@/components/MemberMobileBottomNav";
import AdminMobileBottomNav from "@/components/admin/AdminMobileBottomNav";

type Filter = "alla" | "bokade" | "lediga" | "har" | "utcheckad" | "inte_har";

const PLACES = Array.from({ length: 45 }, (_, i) => i + 1);

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shiftDate = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const EveningRound = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: worker } = useWorker(user?.id);
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal());
  const { data: round, date } = useEveningRound(worker?.id, isAdmin, selectedDate);
  const {
    data: guests = [],
    addGuest,
    updateGuest,
    deleteGuest,
  } = useEveningRoundGuests(round?.id, date, isAdmin);
  const { data: session, start: startSession, end: endSession } = useEveningRoundSession(
    worker?.id,
    date,
  );
  const { data: adminSessions = [] } = useEveningRoundSessionsForDate(date, isAdmin);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alla");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EveningRoundGuest | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<number | null>(null);

  const today = todayLocal();
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);
  const datePresets: { id: string; label: string; value: string }[] = [
    { id: "yesterday", label: "Igår", value: yesterday },
    { id: "today", label: "Idag", value: today },
    { id: "tomorrow", label: "Imorgon", value: tomorrow },
  ];

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  const guestsByPlace = useMemo(() => {
    const m = new Map<number, EveningRoundGuest>();
    guests.forEach((g) => m.set(g.place_number, g));
    return m;
  }, [guests]);

  const unpaidCount = useMemo(
    () => guests.filter((g) => !g.payment_method || !g.payment_amount).length,
    [guests],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return PLACES.filter((p) => {
      const g = guestsByPlace.get(p);
      if (filter === "bokade" && !g) return false;
      if (filter === "lediga" && g) return false;
      if (filter === "har" && g?.status !== "here") return false;
      if (filter === "utcheckad" && g?.status !== "checked_out") return false;
      if (filter === "inte_har" && g?.status !== "not_here") return false;
      if (s) {
        const matchesPlace = String(p).includes(s);
        const matchesName = g?.guest_name.toLowerCase().includes(s);
        if (!matchesPlace && !matchesName) return false;
      }
      return true;
    });
  }, [filter, search, guestsByPlace]);

  const counts = useMemo(() => {
    const here = guests.filter((g) => g.status === "here").length;
    const out = guests.filter((g) => g.status === "checked_out").length;
    const not = guests.filter((g) => g.status === "not_here").length;
    const free = 45 - guests.length;
    return { here, out, not, free, booked: guests.length };
  }, [guests]);

  const openAdd = (place: number) => {
    setEditing(null);
    setSelectedPlace(place);
    setModalOpen(true);
  };

  const openEdit = (g: EveningRoundGuest) => {
    setEditing(g);
    setSelectedPlace(g.place_number);
    setModalOpen(true);
  };

  const handleSave = async (input: GuestInput) => {
    if (editing) {
      await updateGuest.mutateAsync({ id: editing.id, ...input });
    } else {
      await addGuest.mutateAsync(input);
    }
  };

  const handleStatus = (id: string, status: GuestStatus) => {
    updateGuest.mutate({ id, status });
  };

  if (authLoading || adminLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kvällsrundan</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(date).toLocaleDateString("sv-SE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <EveningRoundCreateDialog />
              <EveningRoundExportDialog />
              <Badge className="gap-1">
                <Shield className="h-3 w-3" />
                ADMIN
              </Badge>
            </div>
          )}
        </header>

        <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="h-9 w-9 rounded-xl border border-border bg-card hover:bg-accent flex items-center justify-center"
              aria-label="Föregående dag"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <div className="text-sm font-semibold capitalize">
                {new Date(date).toLocaleDateString("sv-SE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
            </div>
            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              disabled={selectedDate >= tomorrow}
              className="h-9 w-9 rounded-xl border border-border bg-card hover:bg-accent flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Nästa dag"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {datePresets.map((p) => {
              const active = selectedDate === p.value;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedDate(p.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            <div className="relative ml-auto">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || todayLocal())}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Välj annat datum"
              />
            </div>
          </div>
          {!round && selectedDate !== today && (
            <p className="text-xs text-muted-foreground">
              Ingen runda finns för valt datum. {isAdmin ? "Skapa via knappen ovan." : "Be admin skapa en."}
            </p>
          )}
        </div>

        {/* Session-loggning för medarbetare */}
        {!isAdmin && worker && selectedDate === today && (
          <div className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              {session?.session_start && !session?.session_end && (
                <span className="font-medium text-emerald-700">
                  Rundan pågår sedan {new Date(session.session_start).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {session?.session_start && session?.session_end && (
                <span className="text-muted-foreground">
                  Rundan slutad {new Date(session.session_end).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {!session?.session_start && (
                <span className="text-muted-foreground">Du har inte startat rundan än</span>
              )}
            </div>
            {session?.session_start && !session?.session_end ? (
              <Button size="sm" variant="outline" onClick={() => endSession.mutate()}>
                <Square className="h-4 w-4" />
                Slutade rundan
              </Button>
            ) : (
              <Button size="sm" onClick={() => startSession.mutate()}>
                <Play className="h-4 w-4" />
                {session?.session_end ? "Starta om" : "Starta rundan"}
              </Button>
            )}
          </div>
        )}

        {/* Admin: vilka medarbetare gick rundan */}
        {isAdmin && adminSessions.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rundan gick av
            </div>
            <ul className="space-y-1">
              {adminSessions.map((s) => (
                <li key={s.id} className="text-sm flex items-center justify-between gap-2">
                  <span className="font-medium">{s.worker_name ?? "Okänd"}</span>
                  <span className="text-muted-foreground text-xs">
                    {s.session_start
                      ? new Date(s.session_start).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                    {" → "}
                    {s.session_end
                      ? new Date(s.session_end).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                      : "pågår"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unpaidCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {unpaidCount} ej betalt
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök gäst eller plats…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "alla", label: `Alla (${counts.booked + counts.free})` },
              { id: "bokade", label: `Upptagen (${counts.booked})` },
              { id: "lediga", label: `Ledig (${counts.free})` },
              { id: "har", label: `Här (${counts.here})` },
              { id: "utcheckad", label: `Utcheckad (${counts.out})` },
              { id: "inte_har", label: `Inte här (${counts.not})` },
            ] as { id: Filter; label: string }[]
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="hidden md:grid grid-cols-4 gap-3">
          <SummaryCard label="Här" value={counts.here} className="text-emerald-600" />
          <SummaryCard label="Utcheckad" value={counts.out} className="text-amber-600" />
          <SummaryCard label="Inte här" value={counts.not} className="text-destructive" />
          <SummaryCard label="Lediga" value={counts.free} className="text-muted-foreground" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-8">
              Inga platser matchade sökningen
            </div>
          )}
          {filtered.map((p) => {
            const g = guestsByPlace.get(p);
            if (g) {
              return (
                <EveningRoundCard
                  key={p}
                  guest={g}
                  onStatusChange={handleStatus}
                  onEdit={openEdit}
                />
              );
            }
            return (
              <QuickReserveCard
                key={p}
                placeNumber={p}
                date={date}
                onQuickReserve={(input) => addGuest.mutateAsync(input)}
                onOpenFull={openAdd}
              />
            );
          })}
        </div>

        <div className="fixed md:static bottom-20 right-4 md:bottom-auto md:right-auto z-20">
          <Button
            size="lg"
            className="rounded-full md:rounded-xl shadow-lg md:shadow-none"
            onClick={() => {
              const firstFree = PLACES.find((p) => !guestsByPlace.has(p));
              if (firstFree) openAdd(firstFree);
            }}
          >
            <Plus className="h-4 w-4" />
            Lägg till gäst
          </Button>
        </div>
      </div>

      <EveningRoundModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        placeNumber={selectedPlace}
        guest={editing}
        defaultDate={date}
        onSave={handleSave}
        onDelete={(id) => deleteGuest.mutateAsync(id)}
      />

      {isAdmin ? (
        <AdminMobileBottomNav active="kvallsrundan" />
      ) : (
        <MemberMobileBottomNav active="kvallsrundan" />
      )}
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold mt-1 ${className ?? ""}`}>{value}</div>
  </div>
);

export default EveningRound;
