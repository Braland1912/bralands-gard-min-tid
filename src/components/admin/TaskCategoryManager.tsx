import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Coffee,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  Tags,
} from "lucide-react";
import {
  useManageTaskCategories,
  useSetTaskCategoryActive,
  useSwapTaskCategoryOrder,
  type ManagedTaskCategory,
} from "@/hooks/useManageTaskCategories";
import TaskCategoryDialog from "@/components/admin/TaskCategoryDialog";
import { cn } from "@/lib/utils";

const Badge = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "amber";
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
      tone === "amber"
        ? "bg-amber-100 text-amber-900"
        : "bg-muted text-muted-foreground",
    )}
  >
    {children}
  </span>
);

interface RowProps {
  cat: ManagedTaskCategory;
  index: number;
  total: number;
  onEdit: (cat: ManagedTaskCategory) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onArchive: () => void;
  onRestore: () => void;
}

const CategoryRow = ({
  cat,
  index,
  total,
  onEdit,
  onMoveUp,
  onMoveDown,
  onArchive,
  onRestore,
}: RowProps) => {
  const checklistCount = cat.checklist_items?.length ?? 0;
  return (
    <Card className="p-3 bg-card">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">
              {cat.label}
            </span>
            {cat.is_break && (
              <Badge tone="amber">
                <Coffee className="h-3 w-3" /> Rast
              </Badge>
            )}
            {cat.requires_note && (
              <Badge>
                <FileText className="h-3 w-3" /> Kräver notering
              </Badge>
            )}
            {checklistCount > 0 && (
              <Badge>
                <ListChecks className="h-3 w-3" /> {checklistCount} punkter
              </Badge>
            )}
          </div>
          {checklistCount > 0 && (
            <ul className="mt-2 ml-1 space-y-0.5 text-xs text-muted-foreground">
              {cat.checklist_items!.map((item, i) => (
                <li key={i} className="truncate">
                  • {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {cat.is_active ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onMoveUp}
                disabled={index === 0}
                aria-label="Flytta upp"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onMoveDown}
                disabled={index === total - 1}
                aria-label="Flytta ner"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(cat)}
                aria-label="Redigera"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onArchive}
                aria-label="Arkivera"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestore}
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Återställ
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

const TaskCategoryManager = () => {
  const { data: categories = [], isLoading } = useManageTaskCategories();
  const setActive = useSetTaskCategoryActive();
  const swapOrder = useSwapTaskCategoryOrder();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedTaskCategory | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ManagedTaskCategory | null>(
    null,
  );
  const [archivedOpen, setArchivedOpen] = useState(true);

  const active = useMemo(
    () =>
      categories
        .filter((c) => c.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );
  const archived = useMemo(
    () =>
      categories
        .filter((c) => !c.is_active)
        .sort((a, b) => a.label.localeCompare(b.label, "sv")),
    [categories],
  );

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (cat: ManagedTaskCategory) => {
    setEditing(cat);
    setDialogOpen(true);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const a = active[idx];
    const b = active[idx + dir];
    if (!a || !b) return;
    swapOrder.mutate({
      a: { id: a.id, sort_order: a.sort_order },
      b: { id: b.id, sort_order: b.sort_order },
    });
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            Uppgifter
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hantera chips och checklistor som medarbetarna ser.
          </p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Lägg till</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Aktiva ({active.length})
            </p>
            {active.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Inga aktiva uppgifter. Tryck "Lägg till" för att skapa en.
              </Card>
            ) : (
              <div className="space-y-2">
                {active.map((cat, idx) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    index={idx}
                    total={active.length}
                    onEdit={openEdit}
                    onMoveUp={() => move(idx, -1)}
                    onMoveDown={() => move(idx, 1)}
                    onArchive={() => setArchiveTarget(cat)}
                    onRestore={() =>
                      setActive.mutate({ id: cat.id, is_active: true })
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {archived.length > 0 && (
            <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors py-1">
                  <span>Arkiverade ({archived.length})</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      archivedOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2 opacity-80">
                {archived.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    index={0}
                    total={1}
                    onEdit={openEdit}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                    onArchive={() => {}}
                    onRestore={() =>
                      setActive.mutate({ id: cat.id, is_active: true })
                    }
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <TaskCategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />

      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivera uppgift?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveTarget?.label}</strong> försvinner från
              medarbetarnas chips. Tidigare loggar påverkas inte och du kan
              återställa uppgiften när som helst.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveTarget) {
                  setActive.mutate({ id: archiveTarget.id, is_active: false });
                }
                setArchiveTarget(null);
              }}
            >
              Arkivera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskCategoryManager;
