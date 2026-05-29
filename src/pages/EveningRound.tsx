import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Plus, AlertTriangle, Calendar, ChevronLeft, ChevronRight, ChevronDown, Play, Square, MapPin, MapPinPlus, Tent, CreditCard, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import EveningRoundSummaryForm from "@/components/EveningRoundSummary";
import EveningRoundHistory from "@/components/EveningRoundHistory";
import EveningRoundExtendDialog from "@/components/EveningRoundExtendDialog";
import EveningRoundExtendSearch from "@/components/EveningRoundExtendSearch";
import ShiftChecklistViewer from "@/components/ShiftChecklistViewer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import QuickReserveCard from "@/components/QuickReserveCard";

import MemberMobileBottomNav from "@/components/MemberMobileBottomNav";
import AdminMobileBottomNav from "@/components/admin/AdminMobileBottomNav";
import AdminExtraPlacesDialog from "@/components/admin/AdminExtraPlacesDialog";
import AdminDailySummaries from "@/components/admin/AdminDailySummaries";
import { STANDARD_PLACES } from "@/lib/place-label";
import { formatLocalDate } from "@/lib/date-format";

type Filter = "alla" | "bokade" | "lediga" | "har" | "inte_har" | "ej_betalt" | "fordon" | "talt";

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

  // Hitta dagens evening_round-pass för medarbetaren (för checklista)
  const { data: roundShiftId } = useQuery({
    queryKey: ["evening-round-shift", user?.id, date],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("schedules")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", date)
        .eq("shift_type", "evening_round")
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!user?.id && !isAdmin,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alla");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EveningRoundGuest | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [pickPlaceOpen, setPickPlaceOpen] = useState(false);
  const [newPlaceLabel, setNewPlaceLabel] = useState("");
  const [extendingGuest, setExtendingGuest] = useState<EveningRoundGuest | null>(null);
  const [extendSearchOpen, setExtendSearchOpen] = useState(false);
  const [addMode, setAddMode] = useState<"normal" | "prepaid" | "temporary">("normal");
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: extraPlaces = [], addPlace, deletePlace, renamePlace } = useEveningRoundExtraPlaces(round?.id);
  const allPlaces = useMemo(() => {
    const extras = extraPlaces.map((p) => p.label);
    // Standardplatser först, sedan extra (sortering bevaras enligt skapelseordning)
    const set = new Set<string>(STANDARD_PLACES);
    extras.forEach((l) => set.add(l));
    // Inkludera även temporära platser som har en gäst kvar för dagen,
    // även om extra-place-raden tillhör en tidigare runda.
    guests.forEach((g) => {
      if (g.place_label) set.add(g.place_label);
    });
    return Array.from(set);
  }, [extraPlaces, guests]);

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

  const incomingGuestsAll = useMemo(
    () => guests.filter((g) => !g.place_label && g.is_prepaid),
    [guests],
  );

  const temporaryGuests = useMemo(
    () => guests.filter((g) => !g.place_label && g.accommodation_type === "temporary" && !g.is_prepaid),
    [guests],
  );

  const otherUnassignedGuests = useMemo(
    () => guests.filter((g) => !g.place_label && !g.is_prepaid && g.accommodation_type !== "temporary"),
    [guests],
  );

  const unpaidCount = useMemo(
    () => guests.filter((g) => !g.payment_method || !g.payment_amount).length,
    [guests],
  );

  const incomingGuests = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return incomingGuestsAll;
    return incomingGuestsAll.filter((g) => {
      return (
        g.guest_name?.toLowerCase().includes(s) ||
        g.registration_number?.toLowerCase().includes(s) ||
        g.trailer_registration?.toLowerCase().includes(s) ||
        g.temp_description?.toLowerCase().includes(s) ||
        g.notes?.toLowerCase().includes(s)
      );
    });
  }, [incomingGuestsAll, search]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allPlaces.filter((p) => {
      const g = guestsByPlace.get(p);
      if (filter === "bokade" && !g) return false;
      if (filter === "lediga" && g) return false;
      if (filter === "har" && g?.status !== "here") return false;
      if (filter === "inte_har" && g?.status !== "not_here") return false;
      if (filter === "ej_betalt" && (!g || (g.payment_method && g.payment_amount))) return false;
      if (filter === "fordon" && g?.accommodation_type !== "vehicle") return false;
      if (filter === "talt" && g?.accommodation_type !== "tent") return false;
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
    const not = guests.filter((g) => g.status === "not_here").length;
    const assignedGuestIds = new Set(
      guests.filter((g) => g.place_label && allPlaces.includes(g.place_label)).map((g) => g.id),
    );
    const booked = assignedGuestIds.size;
    const free = Math.max(0, allPlaces.length - booked);
    const vehicles = guests.filter((g) => g.accommodation_type === "vehicle").length;
    const tents = guests.filter((g) => g.accommodation_type === "tent").length;
    return { here, not, free, booked, vehicles, tents };
  }, [guests, allPlaces]);

  const openAdd = (place: string) => {
    setEditing(null);
    setSelectedPlace(place);
    setAddMode("normal");
    setModalOpen(true);
  };

  const openEdit = (g: EveningRoundGuest) => {
    setEditing(g);
    setSelectedPlace(g.place_label);
    setAddMode("normal");
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
    <div className="min-h-screen bg-background pb-36 md:pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kvällsrundan</h1>
            <p className="text-sm text-muted-foreground">
              {formatLocalDate(date, "long")}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <AdminExtraPlacesDialog currentRoundId={round?.id} />
              <EveningRoundExportDialog />
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
                {formatLocalDate(date, "long")}
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
              Ingen runda finns för valt datum.
            </p>
          )}
        </div>

        <Tabs defaultValue="rundan" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="rundan">Rundan</TabsTrigger>
            <TabsTrigger value="forbetalda" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              <span>Förbetalda{incomingGuestsAll.length > 0 ? ` (${incomingGuestsAll.length})` : ""}</span>
            </TabsTrigger>
            <TabsTrigger value="redovisning">Redovisning</TabsTrigger>
            <TabsTrigger value="checklista">{isAdmin ? "Historik" : "Checklista"}</TabsTrigger>
          </TabsList>


          <TabsContent value="rundan" className="space-y-4 mt-0">

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
              När gicks rundan
            </div>
            <ul className="space-y-1">
              {adminSessions.map((s) => (
                <li key={s.id} className="text-sm flex items-center justify-between gap-2">
                  <span className="font-medium">{s.worker_name ?? "Administratör"}</span>
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

        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(
              [
                { id: "alla", label: `Alla (${counts.booked + counts.free})` },
                { id: "bokade", label: `Upptagen (${counts.booked})` },
                { id: "lediga", label: `Lediga (${counts.free})` },
                { id: "har", label: `På plats (${counts.here})` },
                { id: "inte_har", label: `Ej kommit (${counts.not})` },
                { id: "ej_betalt", label: `Ej betalt (${unpaidCount})` },
                { id: "fordon", label: `Fordon (${counts.vehicles})` },
                { id: "talt", label: `Tält (${counts.tents})` },
              ] as { id: Filter; label: string }[]
            ).map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`w-full px-3 py-2 rounded-full text-sm font-medium border transition-colors text-center truncate ${
                  filter === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setExtendSearchOpen(true)}
            >
              <Calendar className="h-4 w-4" />
              Förläng tidigare
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditing(null);
                setSelectedPlace(null);
                setAddMode("temporary");
                setModalOpen(true);
              }}
            >
              <Tent className="h-4 w-4" />
              Tillfällig plats
            </Button>
          </div>
        </div>


        {incomingGuests.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                Inkommande · förbetalda ({incomingGuests.length})
              </div>
              <div className="text-[11px] text-sky-800/80">Tryck för att tilldela plats</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {incomingGuests.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => openEdit(g)}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-card px-3 py-1.5 text-xs font-medium hover:bg-sky-100 transition-colors"
                >
                  <MapPinPlus className="h-3.5 w-3.5 text-sky-700" aria-label="Tilldela plats" />
                  <span className="sr-only">Tilldela plats</span>
                  <span className="font-semibold">{g.guest_name || g.registration_number || (g.accommodation_type === "tent" ? "Tält" : g.accommodation_type === "temporary" ? "Tillfällig" : "Gäst")}</span>
                  {g.payment_method && g.payment_amount && (
                    <span className="text-muted-foreground">
                      · {g.payment_amount} {g.payment_currency ?? "kr"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {temporaryGuests.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tillfälliga platser ({temporaryGuests.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {temporaryGuests.map((g) => {
                const ownerName = ownersByRoundId?.get(g.evening_round_id) ?? null;
                return (
                  <EveningRoundCard
                    key={g.id}
                    guest={g}
                    onStatusChange={handleStatus}
                    onEdit={openEdit}
                    ownerName={ownerName}
                    onExtend={setExtendingGuest}
                  />
                );
              })}
            </div>
          </div>
        )}

        {otherUnassignedGuests.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Utan plats ({otherUnassignedGuests.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {otherUnassignedGuests.map((g) => {
                const ownerName = ownersByRoundId?.get(g.evening_round_id) ?? null;
                return (
                  <EveningRoundCard
                    key={g.id}
                    guest={g}
                    onStatusChange={handleStatus}
                    onEdit={openEdit}
                    ownerName={ownerName}
                    onExtend={setExtendingGuest}
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
                  onExtend={setExtendingGuest}
                />
              );
            }
            const extra = extraPlaces.find((ep) => ep.label === p);
            return (
              <QuickReserveCard
                key={p}
                placeLabel={p}
                date={date}
                onQuickReserve={(input) => addGuest.mutateAsync(input)}
                onOpenFull={openAdd}
                onRemoveExtraPlace={extra ? () => deletePlace.mutate(extra.id) : undefined}
                prepaidGuests={incomingGuestsAll}
                onAssignPrepaid={(guestId) =>
                  updateGuest.mutateAsync({ id: guestId, place_label: p, status: "here" })
                }
              />
            );
          })}
        </div>

        <div className="fixed right-4 md:right-8 md:bottom-8 z-20 bottom-[calc(5rem+env(safe-area-inset-bottom))] flex flex-col items-end gap-2">
          <Button
            size="lg"
            aria-label="Lägg till gäst på plats"
            className="rounded-full shadow-lg h-14 w-14 p-0"
            onClick={() => {
              setEditing(null);
              setSelectedPlace(null);
              setAddMode("normal");
              setPickPlaceOpen(true);
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

          </TabsContent>

          <TabsContent value="forbetalda" className="space-y-4 mt-0">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Förbetalda gäster</h2>
                  <p className="text-sm text-muted-foreground">
                    Lista över gäster som registrerats på förhand. Tryck på en gäst för att tilldela plats eller redigera.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setSelectedPlace(null);
                    setAddMode("prepaid");
                    setModalOpen(true);
                  }}
                  className="gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Ny förbetald
                </Button>
              </div>
            </div>

            {incomingGuestsAll.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Inga förbetalda gäster ännu</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Registrera en gäst i förväg så syns den här tills du tilldelar plats.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {incomingGuestsAll.map((g) => {
                  const name = g.guest_name || g.registration_number || (g.accommodation_type === "tent" ? "Tält" : g.accommodation_type === "temporary" ? "Tillfällig" : "Gäst");
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        className="w-full text-left rounded-2xl border border-border bg-card p-3 hover:bg-accent transition-colors flex items-start gap-3"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <MapPinPlus className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold truncate">{name}</div>
                            {g.payment_method && g.payment_amount && (
                              <div className="text-xs font-medium text-muted-foreground shrink-0">
                                {g.payment_amount} {g.payment_currency ?? "kr"}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>
                              {formatLocalDate(g.arrival_date, "short")} → {formatLocalDate(g.departure_date, "short")}
                            </span>
                            {g.accommodation_type === "tent" && <span>· Tält{g.tent_persons ? ` ${g.tent_persons} pers` : ""}</span>}
                            {g.accommodation_type === "vehicle" && g.registration_number && <span>· {g.registration_number}</span>}
                            {g.nationality && <span>· {g.nationality}</span>}
                            {g.has_electricity && <span>· El</span>}
                          </div>
                          {g.notes && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{g.notes}</div>
                          )}
                          <div className="text-[11px] font-medium text-primary">Tryck för att tilldela plats</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="redovisning" className="mt-0">
            {isAdmin ? (
              <AdminDailySummaries roundDate={date} eveningRoundId={round?.id} />
            ) : (
              <EveningRoundSummaryForm
                eveningRoundId={round?.id}
                workerId={worker?.id}
                roundDate={date}
                showQuickStart={selectedDate === today}
                showChecklist={false}
              />
            )}
          </TabsContent>

          <TabsContent value="checklista" className="mt-0 space-y-4">
            {isAdmin ? (
              <EveningRoundHistory />
            ) : (
              <>
                <EveningRoundSummaryForm
                  eveningRoundId={round?.id}
                  workerId={worker?.id}
                  roundDate={date}
                  showQuickStart={selectedDate === today}
                  showCashSection={false}
                />
                {roundShiftId ? (
                  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <ShiftChecklistViewer shiftId={roundShiftId} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                    Ingen passchecklista hittad — du är inte schemalagd på kvällsrundan idag.
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EveningRoundModal
        mode={addMode}
        open={modalOpen}
        onOpenChange={setModalOpen}
        placeLabel={selectedPlace}
        guest={editing}
        defaultDate={date}
        onSave={handleSave}
        onDelete={(id) => deleteGuest.mutateAsync(id)}
        availablePlaces={allPlaces}
        takenPlaces={Array.from(guestsByPlace.keys())}
        extraPlaces={extraPlaces.map((p) => ({ id: p.id, label: p.label }))}
        onAddPlace={async (label) => {
          const created = await addPlace.mutateAsync(label);
          return created.label;
        }}
        onRenamePlace={(id, newLabel) => renamePlace.mutateAsync({ id, newLabel })}
        onDeletePlace={(id) => deletePlace.mutateAsync(id)}
        onExtend={(g) => setExtendingGuest(g)}
      />

      <EveningRoundExtendDialog
        open={!!extendingGuest}
        onOpenChange={(o) => !o && setExtendingGuest(null)}
        guest={extendingGuest}
        viewDate={today}
        onExtended={() => {
          // Hoppa till idag så den förlängda gästen syns direkt
          setSelectedDate(today);
        }}
      />

      <EveningRoundExtendSearch
        open={extendSearchOpen}
        onOpenChange={setExtendSearchOpen}
        viewDate={today}
        onPick={(g) => setExtendingGuest(g)}
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
                  maxLength={60}
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
              <div
                className={`text-[11px] text-right tabular-nums ${
                  newPlaceLabel.length >= 60
                    ? "text-destructive font-medium"
                    : newPlaceLabel.length >= 50
                      ? "text-amber-600"
                      : "text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {newPlaceLabel.length} / 60 tecken
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
