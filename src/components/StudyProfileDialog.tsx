import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { UserProfile } from "@/lib/settings";

interface StudyProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (profile: UserProfile) => void;
  initialProfile?: UserProfile;
}

const INTEREST_OPTIONS = [
  "Gaming",
  "Technology",
  "Art",
  "Sports",
  "Music",
  "Science",
  "Mathematics",
  "History",
  "Literature",
];

const GRADE_OPTIONS = [
  "Elementary",
  "Middle School",
  "High School",
  "College",
  "Graduate",
  "Professional",
];

const EDUCATION_LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

const SUBJECT_SUGGESTIONS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "English",
  "History",
  "Geography",
  "Art",
  "Music",
];

export const StudyProfileDialog = ({
  open,
  onOpenChange,
  onSave,
  initialProfile,
}: StudyProfileDialogProps) => {
  const [interests, setInterests] = useState<string[]>(
    initialProfile?.interests || []
  );
  const [grade, setGrade] = useState<string>(initialProfile?.grade || "");
  const [educationLevel, setEducationLevel] = useState<string>(
    initialProfile?.educationLevel || ""
  );
  const [subjects, setSubjects] = useState<string[]>(initialProfile?.subjects || []);
  const [customSubject, setCustomSubject] = useState("");

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const addCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects((prev) => [...prev, trimmed]);
      setCustomSubject("");
    }
  };

  const handleSave = () => {
    const profile: UserProfile = {
      interests,
      grade,
      educationLevel,
      subjects,
      setupComplete: true,
    };
    onSave(profile);
    onOpenChange(false);
  };

  const isComplete = interests.length > 0 && grade && educationLevel && subjects.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>Set Up Study Profile</DialogTitle>
          <DialogDescription>
            Tell us about yourself so we can personalize your learning experience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Interests */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What interests you? (Select at least 1)</Label>
            <div className="grid grid-cols-2 gap-2">
              {INTEREST_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleInterest(option)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                    interests.includes(option)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Checkbox
                    checked={interests.includes(option)}
                    onCheckedChange={() => toggleInterest(option)}
                    className="pointer-events-none"
                  />
                  <span className="text-left">{option}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Grade */}
          <div className="space-y-2">
            <Label htmlFor="grade" className="text-sm font-medium">
              Grade / Education Level
            </Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger id="grade">
                <SelectValue placeholder="Select your grade" />
              </SelectTrigger>
              <SelectContent>
                {GRADE_OPTIONS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Education Level */}
          <div className="space-y-2">
            <Label htmlFor="level" className="text-sm font-medium">
              Your Knowledge Level
            </Label>
            <Select value={educationLevel} onValueChange={setEducationLevel}>
              <SelectTrigger id="level">
                <SelectValue placeholder="Select your level" />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVEL_OPTIONS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subjects */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              What subjects are you studying? (Select at least 1)
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
              {SUBJECT_SUGGESTIONS.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => toggleSubject(subject)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors text-left ${
                    subjects.includes(subject)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Checkbox
                    checked={subjects.includes(subject)}
                    onCheckedChange={() => toggleSubject(subject)}
                    className="pointer-events-none"
                  />
                  <span className="truncate">{subject}</span>
                </button>
              ))}
            </div>

            {/* Custom subject input */}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Add custom subject"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSubject();
                  }
                }}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomSubject}
                disabled={!customSubject.trim()}
              >
                Add
              </Button>
            </div>

            {/* Selected subjects display */}
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {subjects.map((s) => (
                  <div
                    key={s}
                    className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-foreground"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className="rounded-full p-0.5 hover:bg-primary/30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={!isComplete}
            className="w-full"
          >
            Save & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
