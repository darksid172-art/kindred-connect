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
import { FileEdit, ShieldAlert } from "lucide-react";
import { useMemo } from "react";

interface SelfEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  oldContent: string;
  newContent: string;
  explanation: string;
  onApprove: () => void;
}

// Tiny line-by-line diff (no deps). Marks added/removed/unchanged.
type DiffLine = { kind: "add" | "del" | "ctx"; text: string };

function quickDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < aLines.length || j < bLines.length) {
    if (i < aLines.length && j < bLines.length && aLines[i] === bLines[j]) {
      out.push({ kind: "ctx", text: aLines[i] });
      i++;
      j++;
      continue;
    }
    // look ahead — does aLines[i] appear soon in b?
    const nextMatchInB = bLines.indexOf(aLines[i] ?? "\u0000", j);
    const nextMatchInA = aLines.indexOf(bLines[j] ?? "\u0000", i);
    if (nextMatchInB !== -1 && (nextMatchInA === -1 || nextMatchInB - j <= nextMatchInA - i)) {
      while (j < nextMatchInB) {
        out.push({ kind: "add", text: bLines[j++] });
      }
    } else if (nextMatchInA !== -1) {
      while (i < nextMatchInA) {
        out.push({ kind: "del", text: aLines[i++] });
      }
    } else {
      if (i < aLines.length) out.push({ kind: "del", text: aLines[i++] });
      if (j < bLines.length) out.push({ kind: "add", text: bLines[j++] });
    }
  }
  return out;
}

export const SelfEditDialog = ({
  open,
  onOpenChange,
  filePath,
  oldContent,
  newContent,
  explanation,
  onApprove,
}: SelfEditDialogProps) => {
  const diff = useMemo(() => quickDiff(oldContent, newContent), [oldContent, newContent]);
  const adds = diff.filter((d) => d.kind === "add").length;
  const dels = diff.filter((d) => d.kind === "del").length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-primary" />
            SARVIS wants to edit its own code
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {explanation}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div className="text-amber-900 dark:text-amber-200">
            This will overwrite <code className="font-mono">{filePath}</code> on disk via the local
            SARVIS bridge. A timestamped backup is saved to{" "}
            <code className="font-mono">.sarvis-backups/</code>.
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">+{adds}</span>{" "}
          <span className="text-rose-600 dark:text-rose-400">-{dels}</span>
        </div>

        <div className="rounded-md border bg-muted/30 max-h-[40vh] overflow-auto">
          <pre className="text-xs font-mono leading-relaxed p-3">
            {diff.map((line, idx) => {
              const cls =
                line.kind === "add"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : line.kind === "del"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "text-muted-foreground";
              const prefix = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
              return (
                <div key={idx} className={cls}>
                  <span className="select-none opacity-60 mr-2">{prefix}</span>
                  {line.text || "\u00A0"}
                </div>
              );
            })}
          </pre>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onApprove}>Apply edit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
