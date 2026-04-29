import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Shield, AlertTriangle } from "lucide-react";
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
import EveningRoundCard from "@/components/EveningRoundCard";
import EveningRoundModal from "@/components/EveningRoundModal";
import MemberMobileBottomNav from "@/components/MemberMobileBottomNav";

type Filter = "alla" | "bokade" | "lediga";

const PLACES = Array.from({ length: 45 }, (_, i) => i + 1);

const EveningRound = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: worker } = useWorker(user?.id);
  const { data: round, date } = useEveningRound(worker?.id, isAdmin);
  const {
    data: guests = [],
    addGuest,
    updateGuest,
    deleteGuest,
  } = useEveningRoundGuests(round?.id, date, isAdmin);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alla");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EveningRoundGuest | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<number | null>(null);

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
            <Badge className="gap-1">
              <Shield className="h-3 w-3" />
              ADMIN
            </Badge>
          )}
        </header>

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
              { id: "bokade", label: `Bokade (${counts.booked})` },
              { id: "lediga", label: `Lediga (${counts.free})` },
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
          <SummaryCard label="Utcheckade" value={counts.out} className="text-amber-600" />
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
              <button
                key={p}
                onClick={() => openAdd(p)}
                className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-4 text-left hover:bg-muted transition-colors"
              >
                <div className="text-xs font-medium text-muted-foreground">Plats {p}</div>
                <div className="text-base font-semibold text-foreground mt-1">Ledig</div>
                <div className="text-xs text-muted-foreground mt-1">Klicka för att reservera</div>
              </button>
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

      <MemberMobileBottomNav active="hem" />
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
