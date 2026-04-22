import { useEffect, useState } from "react";
import { CalendarDays, Plus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { createCalendarEvent, listCalendar, type CalendarEvent } from "@/lib/google";

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const CalendarWidget = () => {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // form
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(toLocalInput(now));
  const [end, setEnd] = useState(toLocalInput(later));
  const [reminder, setReminder] = useState(15);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const r = await listCalendar(14);
    if (r.error) setError(r.error);
    else setEvents(r.events ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setCreating(true);
    const r = await createCalendarEvent({
      summary: title.trim(),
      description: description.trim(),
      startISO: new Date(start).toISOString(),
      endISO: new Date(end).toISOString(),
      reminderMinutes: reminder,
    });
    setCreating(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(`Reminder set: ${title}`);
    setDialogOpen(false);
    setTitle("");
    setDescription("");
    refresh();
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-foreground/80" />
          <h3 className="text-sm font-semibold">Calendar</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New reminder</DialogTitle>
                <DialogDescription>Adds an event with a popup reminder to your Google Calendar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ev-title">Title</Label>
                  <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Standup" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-desc">Notes</Label>
                  <Textarea
                    id="ev-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="ev-start">Start</Label>
                    <Input
                      id="ev-start"
                      type="datetime-local"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ev-end">End</Label>
                    <Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-rem">Remind me (minutes before)</Label>
                  <Input
                    id="ev-rem"
                    type="number"
                    min={0}
                    max={1440}
                    value={reminder}
                    onChange={(e) => setReminder(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <div className="max-h-[360px] flex-1 overflow-auto">
        {error && <div className="p-4 text-xs text-destructive">{error}</div>}
        {!error && events === null && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {events?.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">No upcoming events in the next 14 days.</div>
        )}
        {events && events.length > 0 && (
          <ol className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="px-4 py-2.5 text-sm">
                <div className="font-medium text-foreground">{e.summary}</div>
                <div className="text-xs text-muted-foreground">{fmt(e.start)}</div>
                {e.location && <div className="truncate text-xs text-muted-foreground/80">📍 {e.location}</div>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
