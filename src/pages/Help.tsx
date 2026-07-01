import { useNavigate } from "react-router-dom";
import { ChevronRight, Moon, LifeBuoy, BookOpen, Sparkles } from "lucide-react";
import MemberMobileBottomNav from "@/components/MemberMobileBottomNav";

type HelpItem = {
  title: string;
  description: string;
  path: string;
  icon: typeof Moon;
};

const items: HelpItem[] = [
  {
    title: "Kvällsrundan",
    description:
      "Så fungerar kvällsrundan: förbetalda, fasta platser, tillfälliga platser, ekonomi och daglig checklista.",
    path: "/evening-round/help",
    icon: Moon,
  },
  {
    title: "Städrutiner",
    description:
      "Så dammar och städar vi steg för steg: grundordningen, metall & kalk, trasor och grovstädning.",
    path: "/help/cleaning",
    icon: Sparkles,
  },
];

const Help = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <header className="space-y-1 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <LifeBuoy className="h-3.5 w-3.5" />
            Brålands Gård 2026
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Hjälp</h1>
          <p className="text-sm text-muted-foreground">
            Guider och instruktioner för medarbetare. Välj ett ämne nedan.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guider
          </h2>

          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:bg-accent/40 transition-colors flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">{item.title}</div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-muted/30 p-4 flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <p className="font-semibold mb-0.5">Saknas något?</p>
            <p className="text-muted-foreground">
              Hör av dig till admin så lägger vi till fler guider här.
            </p>
          </div>
        </section>
      </div>

      <MemberMobileBottomNav active="hem" />
    </div>
  );
};

export default Help;
