import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useSettings, MODEL_OPTIONS, buildStudyPrompt } from "@/lib/settings";
import { sendChat } from "@/lib/sarvis";

const INTEREST_OPTIONS = ["Gaming","Technology","Art","Sports","Music","Science","Mathematics","History","Literature"];

export const LearnDialog = ({ open, onOpenChange, onResult }: { open: boolean; onOpenChange: (v:boolean)=>void; onResult: (res:any)=>void }) => {
  const [topic, setTopic] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [level, setLevel] = useState<string>("Beginner");
  const [saveProfile, setSaveProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useSettings();
  const [aiMode, setAiMode] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // fetch backend ai-mode state
    (async () => {
      try {
        const resp = await fetch((import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001') + '/api/ai-mode');
        const j = await resp.json(); setAiMode(j);
        setSelectedModel(j?.model ?? settings.model ?? null);
      } catch (e) {
        setAiMode({ mode: 'online', model: settings.model });
      }
    })();
  }, [open]);

  const toggleInterest = (i:string) => setInterests(prev => prev.includes(i)? prev.filter(x=>x!==i) : [...prev, i]);

  const handleStart = async () => {
    if (!topic.trim()) { toast.error('Please enter a topic'); return; }
    setLoading(true);
    try {
      // Build a system prompt depending on study mode/profile
      const systemPrompt = settings.studyMode ? buildStudyPrompt(settings.userProfile) : settings.systemPrompt;

      // inject name pronunciation instruction to ensure consistent behavior
      const nameInstruction = 'When asked your name, display the text SARVIS but pronounce it as the word "service" and respond: "My name is SARVIS (pronounced \"service\")."';
      const combinedSystem = `${systemPrompt}\n\n${nameInstruction}`;

      // Use client-side supabase function via sendChat to pick the configured model
      const msg = [{ role: 'user' as const, content: `Create a structured learning plan for the topic: ${topic}. Include overview, concept tree, 3 short lessons, 3 quiz questions, and 5 flashcards. Interests: ${interests.join(', ')}. Level: ${level}. Output JSON only.` }];

      const modelToUse = selectedModel ?? settings.model;
      const { reply, error } = await sendChat({ messages: [{ role: 'user', content: msg[0].content }], model: modelToUse, systemPrompt: combinedSystem });
      if (error) {
        toast.error(error);
        return;
      }
      let parsed = null;
      try { parsed = JSON.parse(reply as string); } catch (e) { parsed = { raw: reply }; }
      toast.success('Lesson generated');
      onResult(parsed);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Learn Your Way</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Topic</Label>
            <Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="e.g. Photosynthesis" />
          </div>
          <div>
            <Label>Interests (optional)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {INTEREST_OPTIONS.map(i=> (
                <button key={i} type="button" onClick={()=>toggleInterest(i)} className={`px-2 py-1 rounded-md text-sm ${interests.includes(i)? 'bg-primary/10 border-primary border' : 'border border-border'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Level</Label>
            <Select value={level} onValueChange={(v)=>setLevel(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Beginner">Beginner</SelectItem>
                <SelectItem value="Intermediate">Intermediate</SelectItem>
                <SelectItem value="Advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={saveProfile} onCheckedChange={(v)=>setSaveProfile(Boolean(v))} />
            <span className="text-sm">Save learning profile on this PC</span>
          </div>
        </div>
        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={()=>onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleStart} className="flex-1" disabled={loading}>{loading? 'Generating...' : 'Start Learning'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LearnDialog;
