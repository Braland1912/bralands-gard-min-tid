import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Shield, AlertTriangle, Calendar, ChevronLeft, ChevronRight, Play, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { useRoundOwnersForDate } from "@/hooks/useRoundOwnersForDate";
import { useEveningRoundExtraPlaces } from "@/hooks/useEveningRoundExtraPlaces";
import EveningRoundCard from "@/components/EveningRoundCard";
import EveningRoundModal from "@/components/EveningRoundModal";
import EveningRoundExportDialog from "@/components/EveningRoundExportDialog";
import QuickReserveCard from "@/components/QuickReserveCard";
import EveningRoundCreateDialog from "@/components/EveningRoundCreateDialog";
import MemberMobileBottomNav from "@/components/MemberMobileBottomNav";
import AdminMobileBottomNav from "@/components/admin/AdminMobileBottomNav";

type Filter = "alla" | "bokade" | "lediga" | "har" | "utcheckad" | "inte_har";

const STANDARD_PLACES: string[] = [
  ...Array.from({ length: 21 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 6 }, (_, i) => `E${i + 1}`),
];

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
  const { data: adminSessions = [] } = useEveningRoundSessionsForDate(date);
  const { data: ownersByRoundId } = useRoundOwnersForDate(date);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alla");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EveningRoundGuest | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [pickPlaceOpen, setPickPlaceOpen] = useState(false);
  const [newPlaceLabel, setNewPlaceLabel] = useState("");

  const { data: extraPlaces = [], addPlace, deletePlace } = useEveningRoundExtraPlaces(round?.id);
  const allPlaces = useMemo(() => {
    const extras = extraPlaces.map((p) => p.label);
    // Standardplatser först, sedan extra (sortering bevaras enligt skapelseordning)
    const set = new Set<string>(STANDARD_PLACES);
    extras.forEach((l) => set.add(l));
    return Array.from(set);
  }, [extraPlaces]);

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

  // Pågår någon runda just nu (egen eller någon medarbetares för admin)?
  const isRoundOngoing = useMemo(() => {
    if (isAdmin) {
      return adminSessions.some((s) => s.session_start && !s.session_end);
    }
    return !!session?.session_start && !session?.session_end;
  }, [isAdmin, adminSessions, session]);

  // Realtids-poll: refetcha gäster + sessioner var 8s när rundan pågår.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isRoundOngoing) return;
    const i = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-sessions-all"] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-session"] });
    }, 8000);
    return () => window.clearInterval(i);
  }, [isRoundOngoing, queryClient]);

  const guestsByPlace = useMemo(() => {
    const m = new Map<string, EveningRoundGuest>();
    guests.forEach((g) => {
      if (g.place_label) m.set(g.place_label, g);
    });
    return m;
  }, [guests]);

  const unassignedGuests = useMemo(
    () => guests.filter((g) => !g.place_label),
    [guests],
  );

  const unpaidCount = useMemo(
    () => guests.filter((g) => !g.payment_method || !g.payment_amount).length,
    [guests],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allPlaces.filter((p) => {
      const g = guestsByPlace.get(p);
      if (filter === "bokade" && !g) return false;
      if (filter === "lediga" && g) return false;
      if (filter === "har" && g?.status !== "here") return false;
      if (filter === "utcheckad" && g?.status !== "checked_out") return false;
      if (filter === "inte_har" && g?.status !== "not_here") return false;
      if (s) {
        const matchesPlace = p.toLowerCase().includes(s);
        const matchesName = g?.guest_name.toLowerCase().includes(s);
        if (!matchesPlace && !matchesName) return false;
      }
      return true;
    });
  }, [filter, search, guestsByPlace, allPlaces]);

  const counts = useMemo(() => {
    const here = guests.filter((g) => g.status === "here").length;
    const out = guests.filter((g) => g.status === "checked_out").length;
    const not = guests.filter((g) => g.status === "not_here").length;
    const free = allPlaces.length - guests.length;
    return { here, out, not, free, booked: guests.length };
  }, [guests, allPlaces]);

  const openAdd = (place: string) => {
    setEditing(null);
    setSelectedPlace(place);
    setModalOpen(true);
  };

  const openEdit = (g: EveningRoundGuest) => {
    setEditing(g);
    setSelectedPlace(g.place_label);
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
                  Du är ute — Rundan pågår sedan{" "}
                  {new Date(session.session_start).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {session?.session_start && session?.session_end && (
                <span className="text-muted-foreground">
                  Du var ute — Från{" "}
                  {new Date(session.session_start).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                  {" till "}
                  {new Date(session.session_end).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {!session?.session_start && (
                <span className="text-muted-foreground">Du är inte ute än</span>
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
                {session?.session_end ? "Starta om" : "Börja rundan"}
              </Button>
            )}
          </div>
        )}

        {/* Admin: vilka medarbetare gick rundan */}
        {adminSessions.length > 0 && (
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

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <KpiCard
            label="Lediga"
            value={counts.free}
            color="text-muted-foreground"
            dim={!isRoundOngoing && selectedDate !== today}
          />
          <KpiCard
            label="På plats"
            value={counts.here}
            color="text-emerald-600"
            dim={!isRoundOngoing && selectedDate !== today}
            live={isRoundOngoing}
          />
          <KpiCard
            label="Ej kommit"
            value={counts.not}
            color="text-destructive"
            dim={!isRoundOngoing && selectedDate !== today}
          />
        </div>

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


        {unassignedGuests.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Utan plats ({unassignedGuests.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unassignedGuests.map((g) => {
                const ownerName = ownersByRoundId?.get(g.evening_round_id) ?? null;
                return (
                  <EveningRoundCard
                    key={g.id}
                    guest={g}
                    onStatusChange={handleStatus}
                    onEdit={openEdit}
                    ownerName={ownerName}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-8">
              Inga platser matchade sökningen
            </div>
          )}
          {filtered.map((p) => {
            const g = guestsByPlace.get(p);
            if (g) {
              const ownerName = ownersByRoundId?.get(g.evening_round_id) ?? null;
              return (
                <EveningRoundCard
                  key={p}
                  guest={g}
                  onStatusChange={handleStatus}
                  onEdit={openEdit}
                  ownerName={ownerName}
                />
              );
            }
            return (
              <QuickReserveCard
                key={p}
                placeLabel={p}
                date={date}
                onQuickReserve={(input) => addGuest.mutateAsync(input)}
                onOpenFull={openAdd}
              />
            );
          })}
        </div>

        {(
          <div className="fixed md:static bottom-20 right-4 md:bottom-auto md:right-auto z-20">
            <Button
              size="lg"
              aria-label="Lägg till gäst"
              className="rounded-full md:rounded-xl shadow-lg md:shadow-none h-14 w-14 md:h-auto md:w-auto p-0 md:px-4 md:py-2"
              onClick={() => {
                setEditing(null);
                setSelectedPlace(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-6 w-6 md:h-4 md:w-4" />
              <span className="hidden md:inline">Lägg till gäst</span>
            </Button>
          </div>
        )}
      </div>

      <EveningRoundModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        placeLabel={selectedPlace}
        guest={editing}
        defaultDate={date}
        onSave={handleSave}
        onDelete={(id) => deleteGuest.mutateAsync(id)}
        availablePlaces={allPlaces}
        takenPlaces={Array.from(guestsByPlace.keys())}
      />

      <Dialog open={pickPlaceOpen} onOpenChange={setPickPlaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Välj plats</DialogTitle>
            <DialogDescription>
              Tryck på en ledig plats, eller lägg till en ny extra plats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {allPlaces.map((p) => {
                const taken = guestsByPlace.has(p);
                const isExtra = !STANDARD_PLACES.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={taken}
                    onClick={() => {
                      setPickPlaceOpen(false);
                      openAdd(p);
                    }}
                    className={
                      taken
                        ? "h-12 rounded-xl border border-border bg-muted text-muted-foreground text-sm font-medium opacity-60 cursor-not-allowed"
                        : `h-12 rounded-xl border text-sm font-semibold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors ${
                            isExtra
                              ? "border-primary/40 bg-primary/5 text-primary"
                              : "border-border bg-card"
                          }`
                    }
                    title={isExtra ? "Extra plats" : undefined}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {extraPlaces.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Extra platser för denna runda</div>
                <div className="flex flex-wrap gap-2">
                  {extraPlaces.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                    >
                      <span className="font-medium">{p.label}</span>
                      <button
                        type="button"
                        onClick={() => deletePlace.mutate(p.id)}
                        disabled={guestsByPlace.has(p.label)}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Ta bort ${p.label}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t border-border">
              <label className="text-xs font-medium text-muted-foreground">Lägg till en extra plats</label>
              <div className="flex gap-2">
                <Input
                  value={newPlaceLabel}
                  onChange={(e) => setNewPlaceLabel(e.target.value)}
                  placeholder="T.ex. Stuga 1, X1…"
                  maxLength={20}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newPlaceLabel.trim() && round?.id) {
                        addPlace.mutate(newPlaceLabel.trim(), {
                          onSuccess: () => setNewPlaceLabel(""),
                        });
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={!newPlaceLabel.trim() || !round?.id || addPlace.isPending}
                  onClick={() => {
                    addPlace.mutate(newPlaceLabel.trim(), {
                      onSuccess: () => setNewPlaceLabel(""),
                    });
                  }}
                >
                  Lägg till
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

const KpiCard = ({
  label,
  value,
  color,
  dim,
  live,
}: {
  label: string;
  value: number;
  color: string;
  dim?: boolean;
  live?: boolean;
}) => (
  <div
    className={`rounded-2xl border border-border bg-card p-3 transition-opacity ${
      dim ? "opacity-50" : ""
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      {live && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
          aria-label="Live"
        />
      )}
    </div>
    <div className={`text-xl sm:text-2xl font-semibold mt-1 ${color}`}>
      {dim ? "–" : value}
    </div>
  </div>
);

export default EveningRound;
