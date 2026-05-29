import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Plus, AlertTriangle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Play, Square, MapPin, MapPinPlus, Tent, CreditCard, SlidersHorizontal, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { toast } from "sonner";

import MemberMobileBottomNav from "@/components/MemberMobileBottomNav";
import AdminMobileBottomNav from "@/components/admin/AdminMobileBottomNav";
import AdminExtraPlacesDialog from "@/components/admin/AdminExtraPlacesDialog";
import AddPlaceChoiceDialog from "@/components/AddPlaceChoiceDialog";
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

  // Hitta dagens kvällspass för medarbetaren (för passchecklistan).
  // Kvällsrundans checklistmall är kopplad till shift_type = "evening".
  const { data: roundShiftId } = useQuery({
    queryKey: ["evening-round-shift", user?.id, date],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("schedules")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", date)
        .eq("shift_type", "evening")
        .order("shift_index", { ascending: true })
        .limit(1)
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
  const [addPlaceChoiceOpen, setAddPlaceChoiceOpen] = useState(false);

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

  // Räkna bara obetalda gäster som anlände idag (vald dag), så att kvarvarande
  // flernattersgäster med oavslutad betalning inte fortsätter trigga varningen
  // varje dag de bor kvar.
  const unpaidCount = useMemo(
    () =>
      guests.filter(
        (g) =>
          g.arrival_date === selectedDate &&
          (!g.payment_method || !g.payment_amount),
      ).length,
    [guests, selectedDate],
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
    // Kräv att en plats är vald innan man markerar som "på plats".
    // Tillfälliga platser och förbetalda hanteras separat (tempbeskrivning / tilldelning).
    if (status === "here") {
      const g = guests.find((x) => x.id === id);
      if (g && !g.place_label && g.accommodation_type !== "temporary") {
        toast.error("Välj en plats först för att markera som på plats");
        openEdit(g);
        return;
      }
    }
    updateGuest.mutate({ id, status });
  };

  if (authLoading || adminLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-36 md:pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-4">
        {isAdmin && (
          <header className="flex items-center justify-end gap-2">
            <AdminExtraPlacesDialog currentRoundId={round?.id} />
            <EveningRoundExportDialog />
          </header>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kvällsrundan</h1>
            <button
              onClick={() => navigate("/evening-round/help")}
              className="h-6 w-6 rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground text-xs font-semibold flex items-center justify-center"
              aria-label="Hjälp om Kvällsrundan"
              title="Hjälp"
            >
              ?
            </button>
          </div>
          {/* Session-loggning för medarbetare — alltid synlig oavsett aktiv flik */}
          {!isAdmin && worker && selectedDate === today && (
            <div className="flex items-center gap-2 text-xs">
              {session?.session_start && !session?.session_end && (
                <span className="font-medium text-emerald-700">
                  Ute sedan {new Date(session.session_start).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {session?.session_start && session?.session_end && (
                <span className="text-muted-foreground">
                  {new Date(session.session_start).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                  {"–"}
                  {new Date(session.session_end).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {!session?.session_start && (
                <span className="text-muted-foreground">Inte ute än</span>
              )}
              {session?.session_start && !session?.session_end ? (
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => endSession.mutate()}>
                  <Square className="h-3.5 w-3.5" />
                  Avsluta
                </Button>
              ) : (
                <Button size="sm" className="h-8 gap-1.5" onClick={() => startSession.mutate()}>
                  <Play className="h-3.5 w-3.5" />
                  {session?.session_end ? "Starta om" : "Börja rundan"}
                </Button>
              )}
            </div>
          )}
        </div>


        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="h-8 w-8 shrink-0 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center"
            aria-label="Föregående dag"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="relative flex-1 min-w-0 h-8 px-2 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center gap-1.5 text-xs font-semibold capitalize cursor-pointer"
                aria-label="Välj annat datum"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{formatLocalDate(date, "long")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                weekStartsOn={1}
                selected={(() => {
                  const [y, m, d] = selectedDate.split("-").map(Number);
                  return new Date(y, m - 1, d);
                })()}
                onSelect={(d) => {
                  if (!d) return;
                  const yy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const dd = String(d.getDate()).padStart(2, "0");
                  setSelectedDate(`${yy}-${mm}-${dd}`);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {datePresets.map((p) => {
            const active = selectedDate === p.value;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedDate(p.value)}
                className={`h-8 px-2.5 shrink-0 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="h-8 w-8 shrink-0 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center"

            aria-label="Nästa dag"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!round && selectedDate !== today && (
          <p className="text-xs text-muted-foreground -mt-2">Ingen runda finns för valt datum.</p>
        )}

        <Tabs defaultValue="forbetalda" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4 gap-1 h-auto p-1">
            <TabsTrigger value="forbetalda" className="relative px-1 text-xs sm:text-sm">
              Förbetalda
              {incomingGuestsAll.length > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[0.6rem] font-semibold leading-none">
                  {incomingGuestsAll.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rundan" className="px-1 text-xs sm:text-sm">Rundan</TabsTrigger>
            <TabsTrigger value="redovisning" className="px-1 text-xs sm:text-sm">Ekonomi</TabsTrigger>
            <TabsTrigger value="checklista" className="px-1 text-xs sm:text-sm">{isAdmin ? "Historik" : "Lista"}</TabsTrigger>
          </TabsList>


          <TabsContent value="rundan" className="space-y-4 mt-0">



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
          <button
            type="button"
            onClick={() => setFilter(filter === "ej_betalt" ? "alla" : "ej_betalt")}
            aria-pressed={filter === "ej_betalt"}
            className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              filter === "ej_betalt"
                ? "border-destructive bg-destructive/20 text-destructive"
                : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>{unpaidCount} ej betalt</span>
            <span className="ml-auto text-xs font-normal opacity-80">
              {filter === "ej_betalt" ? "Visar bara dessa · tryck för att rensa" : "Tryck för att filtrera"}
            </span>
          </button>
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

        {(() => {
          const filterOptions: { id: Filter; label: string }[] = [
            { id: "alla", label: `Alla (${counts.booked + counts.free})` },
            { id: "bokade", label: `Upptagen (${counts.booked})` },
            { id: "lediga", label: `Lediga (${counts.free})` },
            { id: "har", label: `På plats (${counts.here})` },
            { id: "inte_har", label: `Ej kommit (${counts.not})` },
            { id: "ej_betalt", label: `Ej betalt (${unpaidCount})` },
            { id: "fordon", label: `Fordon (${counts.vehicles})` },
            { id: "talt", label: `Tält (${counts.tents})` },
          ];
          const activeOption = filterOptions.find((o) => o.id === filter);
          const isFiltering = filter !== "alla";
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  aria-expanded={filterOpen}
                  aria-controls="evening-round-filter-panel"
                  className={`flex-1 inline-flex items-center justify-between gap-2 px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
                    isFiltering
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "bg-card text-foreground border-border hover:bg-accent"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <SlidersHorizontal className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {isFiltering ? `Filter: ${activeOption?.label ?? ""}` : "Filtrera"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${filterOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isFiltering && (
                  <button
                    type="button"
                    onClick={() => setFilter("alla")}
                    aria-label="Rensa filter"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div
                id="evening-round-filter-panel"
                className={`grid transition-all duration-200 ease-out ${
                  filterOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="rounded-2xl border border-border bg-card p-2 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {filterOptions.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setFilter(c.id);
                            if (c.id === "alla") setFilterOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-full text-sm font-medium border transition-colors text-center truncate ${
                            filter === c.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:bg-accent"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setExtendSearchOpen(true)}
                >
                  <CalendarIcon className="h-4 w-4" />
                  Förläng tidigare
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setAddPlaceChoiceOpen(true)}
                >
                  <MapPinPlus className="h-4 w-4" />
                  Lägg till plats
                </Button>
              </div>
            </div>
          );
        })()}



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

          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={() => setAddPlaceChoiceOpen(true)}
          >
            <MapPinPlus className="h-4 w-4" />
            Lägg till plats
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
                        className="w-full text-left rounded-2xl border border-sky-200 bg-sky-50/50 p-3 hover:bg-sky-100 transition-colors flex items-start gap-3"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                          <MapPinPlus className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold truncate text-sky-950">{name}</div>
                            {g.payment_method && g.payment_amount && (
                              <div className="text-xs font-medium text-sky-800/80 shrink-0">
                                {g.payment_amount} {g.payment_currency ?? "kr"}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-sky-900/70 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>
                              {formatLocalDate(g.arrival_date, "short")} → {formatLocalDate(g.departure_date, "short")}
                            </span>
                            {g.accommodation_type === "tent" && <span>· Tält{g.tent_persons ? ` ${g.tent_persons} pers` : ""}</span>}
                            {g.accommodation_type === "vehicle" && g.registration_number && <span>· {g.registration_number}</span>}
                            {g.nationality && <span>· {g.nationality}</span>}
                            {g.has_electricity && <span>· El</span>}
                          </div>
                          {g.notes && (
                            <div className="text-xs text-sky-900/70 line-clamp-2">{g.notes}</div>
                          )}
                          <div className="text-[11px] font-medium text-sky-700">Tryck för att tilldela plats</div>
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
                showQuickStart={false}
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
                  showQuickStart={false}
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

      <AddPlaceChoiceDialog
        open={addPlaceChoiceOpen}
        onOpenChange={setAddPlaceChoiceOpen}
        prepaidGuests={incomingGuestsAll}
        onPickNewGuest={() => {
          setAddPlaceChoiceOpen(false);
          setEditing(null);
          setSelectedPlace(null);
          setAddMode("normal");
          setModalOpen(true);
        }}
        onPickPrepaid={(g) => {
          setAddPlaceChoiceOpen(false);
          // Öppna gästen i edit-läge utan plats — användaren väljer eller
          // skapar en tillfällig plats via platsväljaren.
          setEditing(g);
          setSelectedPlace(null);
          setAddMode("normal");
          setModalOpen(true);
        }}
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
