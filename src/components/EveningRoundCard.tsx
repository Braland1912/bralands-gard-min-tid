import { Check, LogOut, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
}

const formatDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

const statusColors: Record<GuestStatus, string> = {
  here: "text-emerald-600",
  checked_out: "text-amber-600",
  not_here: "text-destructive",
};
const statusLabels: Record<GuestStatus, string> = {
  here: "Här",
  checked_out: "Utcheckad",
  not_here: "Inte här",
};

const EveningRoundCard = ({ guest, onStatusChange, onEdit, readOnly = false, ownerName }: Props) => {
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
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-muted-foreground">Plats {guest.place_number}</div>
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
        <div className="text-base font-semibold leading-tight mt-0.5">
          {guest.registration_number || <span className="text-muted-foreground italic">Inget reg.nr</span>}
        </div>
        {guest.notes && (
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {guest.notes}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StatusBtn s="here" Icon={Check} label="Här" />
        <StatusBtn s="checked_out" Icon={LogOut} label="Utcheckad" />
        <StatusBtn s="not_here" Icon={X} label="Inte här" />
        <span className={`text-sm font-medium ${statusColors[guest.status]}`}>
          {statusLabels[guest.status]}
        </span>
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
              {PAYMENT_LABELS[guest.payment_method!]} • {guest.payment_amount} {guest.payment_currency ?? "kr"}
            </div>
          )}
        </div>
        {ownerName && (
          <span className="text-[11px] font-medium text-muted-foreground bg-background border border-border rounded-full px-2 py-0.5">
            Gick: {ownerName}
          </span>
        )}
      </div>
    </div>
  );
};

export default EveningRoundCard;
