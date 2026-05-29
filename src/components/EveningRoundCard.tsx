import { Check, X, CalendarPlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type EveningRoundGuest,
  type GuestStatus,
  PAYMENT_LABELS,
} from "@/hooks/useEveningRoundGuests";
import { getNationality, flagUrl, parseNationality, OTHER_CODE } from "@/lib/nationalities";

interface Props {
  guest: EveningRoundGuest;
  onStatusChange: (id: string, status: GuestStatus) => void;
  onEdit: (guest: EveningRoundGuest) => void;
  /** Read-only: ingen redigering, ingen statusbyte (medarbetare-läge). */
  readOnly?: boolean;
  /** Visas som "Gick: Eva" om angivet. */
  ownerName?: string | null;
  /** Om angiven visas en "Förläng"-knapp på kortet. */
  onExtend?: (guest: EveningRoundGuest) => void;
}

const formatDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

const statusColors: Record<GuestStatus, string> = {
  here: "text-emerald-600",
  not_here: "text-destructive",
};
const statusLabels: Record<GuestStatus, string> = {
  here: "På plats",
  not_here: "Ej kommit",
};

const EveningRoundCard = ({ guest, onStatusChange, onEdit, readOnly = false, ownerName, onExtend }: Props) => {
  const isUnpaid = !guest.payment_method || !guest.payment_amount;
  const parsedNat = parseNationality(guest.nationality);
  const nat = getNationality(guest.nationality);
  const isOtherNat = parsedNat?.code === OTHER_CODE;

  const StatusBtn = ({
    s,
    Icon,
    label,
  }: {
    s: GuestStatus;
    Icon: typeof Check;
    label: string;
  }) => {
    const active = guest.status === s;
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={(e) => {
          e.stopPropagation();
          if (readOnly) return;
          onStatusChange(guest.id, s);
        }}
        aria-label={label}
        aria-pressed={active}
        className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors ${
          active
            ? `${statusColors[s]} border-current bg-current/10`
            : "text-muted-foreground border-border hover:bg-accent"
        } ${readOnly ? "opacity-60 cursor-not-allowed hover:bg-transparent" : ""}`}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  };

  const wrapperProps = readOnly
    ? {
        className:
          "w-full text-left rounded-2xl border border-border bg-muted/30 p-4 space-y-3 opacity-90",
      }
    : {
        role: "button" as const,
        tabIndex: 0,
        onClick: () => onEdit(guest),
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit(guest);
          }
        },
        className:
          "w-full text-left rounded-2xl border border-border bg-card p-4 space-y-3 transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer",
      };

  return (
    <div {...wrapperProps}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-medium text-muted-foreground">
            {guest.accommodation_type === "temporary"
              ? "Tillfällig plats"
              : guest.place_label
                ? `Plats ${guest.place_label}`
                : guest.is_prepaid
                  ? "Förbetald · ingen plats än"
                  : "Ingen plats vald"}
          </div>
          {guest.is_prepaid && !guest.place_label && (
            <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200">
              Förbetald
            </Badge>
          )}
          {guest.accommodation_type === "temporary" && (
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-200">
              Tillfällig
            </Badge>
          )}
          {isOtherNat ? (
            <span
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
              title="Övrig nationalitet"
            >
              <span className="h-3.5 w-5 rounded-[2px] border border-border bg-muted flex items-center justify-center text-[9px]">
                ?
              </span>
              {parsedNat?.custom || "Övrigt"}
            </span>
          ) : (
            nat && (
              <span
                className="flex items-center gap-1"
                title={`${nat.label} (skylt: ${nat.plate})`}
              >
                <img
                  src={flagUrl(nat.code)}
                  alt={nat.label}
                  loading="lazy"
                  className="h-3.5 w-5 rounded-[2px] border border-border object-cover"
                />
                <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                  {nat.plate}
                </span>
              </span>
            )
          )}
        </div>
        {guest.status === "not_here" && guest.accommodation_type !== "temporary" && !guest.is_prepaid && (
          <div className="mt-1">
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              Reserverad
            </Badge>
          </div>
        )}
        <div className="text-base font-semibold leading-tight mt-1">
          {guest.accommodation_type === "temporary" ? (
            <span className="text-sm font-normal text-foreground">
              {guest.guest_name || <span className="text-muted-foreground italic">Inget namn</span>}
            </span>
          ) : guest.accommodation_type === "tent" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide bg-primary/10 text-primary rounded px-1.5 py-0.5">
                Tält
              </span>
              {guest.registration_number && (
                <span className="text-sm font-normal text-muted-foreground">{guest.registration_number}</span>
              )}
            </span>
          ) : (
            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">

              {guest.registration_number ? (
                <span className="text-sm font-normal">{guest.registration_number}</span>
              ) : (
                guest.guest_name || <span className="text-muted-foreground italic">Inget reg.nr</span>
              )}
              {guest.trailer_registration && (
                <span className="text-xs font-normal text-muted-foreground">+ {guest.trailer_registration}</span>
              )}
            </span>
          )}

        </div>
        {guest.accommodation_type === "temporary" && guest.temp_description && (
          <div className="text-xs text-foreground/80 mt-1 line-clamp-3 whitespace-pre-line">
            {guest.temp_description}
          </div>
        )}
        {guest.notes && (
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {guest.notes}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StatusBtn s="here" Icon={Check} label="På plats" />
        <StatusBtn s="not_here" Icon={X} label="Ej kommit" />
        <span className={`text-sm font-medium ${statusColors[guest.status]}`}>
          {statusLabels[guest.status]}
        </span>
        {onExtend && !readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-8 gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              onExtend(guest);
            }}
          >
            <CalendarPlus2 className="h-3.5 w-3.5" />
            Förläng
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Ankomst/Avresa: {formatDate(guest.arrival_date)} → {formatDate(guest.departure_date)}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          {isUnpaid ? (
            <Badge variant="destructive">EJ BETALT</Badge>
          ) : (
            <div className="text-sm font-medium">
              {PAYMENT_LABELS[guest.payment_method!]}
              {guest.payment_method === "O" && guest.payment_other_note
                ? ` (${guest.payment_other_note})`
                : ""}
              {" • "}{guest.payment_amount} {guest.payment_currency ?? "kr"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EveningRoundCard;
