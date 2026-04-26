import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Terminal, ShieldAlert, Check } from "lucide-react";
import type { PlannedCommand } from "@/lib/computer";
import { cn } from "@/lib/utils";

interface ConfirmCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  explanation: string;
  commands: PlannedCommand[];
  os: string;
  onApprove: (selected: PlannedCommand[]) => void;
}

export const ConfirmCommandDialog = ({
  open,
  onOpenChange,
  explanation,
  commands,
  os,
  onApprove,
}: ConfirmCommandDialogProps) => {
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  const toggle = (idx: number) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const selected = commands.filter((_, i) => !skipped.has(i));
  const hasRisky = commands.some((c) => c.needsConfirm);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Approve commands for your {os}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {explanation}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasRisky && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <div className="text-amber-900 dark:text-amber-200">
              Some steps install software, use <code>sudo</code>, or modify system files.
              Review each line and untick anything you do not want to run.
            </div>
          </div>
        )}

        <div className="space-y-2">
          {commands.map((c, i) => {
            const isSkipped = skipped.has(i);
            return (
              <div
                key={i}
                className={cn(
                  "rounded-md border p-3 text-sm transition-opacity",
                  isSkipped ? "opacity-40 border-dashed" : "border-border",
                  c.needsConfirm && !isSkipped && "border-amber-500/40 bg-amber-500/5",
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                    {c.needsConfirm && (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Risky
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => toggle(i)}
                  >
                    {isSkipped ? (
                      <>Include</>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        Included
                      </>
                    )}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs font-mono">
                  {c.cmd}
                </pre>
                {c.why && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{c.why}</p>
                )}
              </div>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={selected.length === 0}
            onClick={() => onApprove(selected)}
          >
            Run {selected.length} command{selected.length === 1 ? "" : "s"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
