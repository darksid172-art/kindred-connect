import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "minimalist" | "amoled" | "abstract";

export type ModelId =
  | "google/gemini-3-flash-preview"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-pro"
  | "openai/gpt-5-mini"
  | "openai/gpt-5";

export type OS = "linux" | "windows" | "macos";

export interface UserProfile {
  interests: string[]; // e.g., ["gaming", "technology", "art"]
  grade: string; // e.g., "High School", "College", "Graduate"
  educationLevel: string; // e.g., "Beginner", "Intermediate", "Advanced"
  subjects: string[]; // e.g., ["Mathematics", "Physics", "Computer Science"]
  setupComplete: boolean;
}

export interface AppSettings {
  theme: Theme;
  model: ModelId;
  systemPrompt: string;
  studyMode: boolean;
  os: OS;
  userProfile?: UserProfile;
}

export const DEFAULT_SYSTEM_PROMPT =
  'You are SARVIS, an advanced AI assistant. Your display name is "SARVIS" (please pronounce it as the word "service" when speaking aloud). If anyone asks who you are, reply: "My name is SARVIS (pronounced \"service\")." Be helpful, concise, and conversational. Use markdown when it improves clarity.';

export const STUDY_SYSTEM_PROMPT =
  'You are SARVIS in "Study Ur Way" mode — a Socratic study tutor. Your display name is "SARVIS" (please pronounce it as the word "service" when speaking aloud). Your job is to teach the user to think for themselves. Rules: (1) Never just dump the answer. Ask one focused guiding question at a time. (2) Break complex topics into bite-sized steps. (3) Offer to quiz the user, generate flashcards, or summarize what they have learned at any point. (4) Praise effort and gently correct mistakes with explanations. (5) Adapt to the user\'s level — if they are stuck, give a smaller hint, not the answer. (6) Use clear markdown: short paragraphs, bullets, and **bold** for key terms. Always end your turn with either a question, a mini-quiz, or an offer ("Want me to quiz you on this?").';

export function buildStudyPrompt(profile?: UserProfile): string {
  if (!profile || !profile.setupComplete) {
    return STUDY_SYSTEM_PROMPT;
  }

  const interestContexts: { [key: string]: string } = {
    gaming: "Use gaming analogies, mechanics, and examples where relevant. Think of concepts as game systems or levels.",
    technology: "Use tech examples, software development concepts, and modern technology references.",
    art: "Use artistic concepts, visual examples, and creative analogies.",
    sports: "Use sports examples, training concepts, and athletic performance references.",
    music: "Use musical concepts, rhythm, patterns, and harmonic relationships.",
    science: "Use scientific method, experiments, and hypothesis-driven examples.",
  };

  let interestAddon = "";
  if (profile.interests && profile.interests.length > 0) {
    const interestDescriptions = profile.interests
      .map((i) => interestContexts[i.toLowerCase()] || "")
      .filter(Boolean);
    if (interestDescriptions.length > 0) {
      interestAddon = `\n\nWhen teaching concepts, relate them to the student's interests: ${profile.interests.join(", ")}. ${interestDescriptions.join(" ")}`;
    }
  }

  const levelAddon =
    profile.educationLevel && profile.educationLevel !== "Beginner"
      ? `\nThe student is at an ${profile.educationLevel} level, so adjust complexity accordingly.`
      : "";

  const subjectAddon =
    profile.subjects && profile.subjects.length > 0
      ? `\nThe student is studying: ${profile.subjects.join(", ")}.`
      : "";

  return (
    STUDY_SYSTEM_PROMPT + interestAddon + levelAddon + subjectAddon
  );
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  model: "google/gemini-3-flash-preview",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  studyMode: false,
  os: "linux",
  userProfile: {
    interests: [],
    grade: "",
    educationLevel: "",
    subjects: [],
    setupComplete: false,
  },
};

export const MODEL_OPTIONS: { value: ModelId; label: string; hint: string }[] = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", hint: "Fast • Default" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Balanced" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Smartest Gemini" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", hint: "OpenAI • Fast" },
  { value: "openai/gpt-5", label: "GPT-5", hint: "OpenAI • Top quality" },
];

export const THEME_OPTIONS: {
  value: Theme;
  label: string;
  hint: string;
  preview: { bg: string; fg: string; accent: string };
}[] = [
  { value: "light", label: "Light", hint: "Bright & clean", preview: { bg: "#ffffff", fg: "#0a0a0a", accent: "#06b6d4" } },
  { value: "dark", label: "Dark", hint: "JARVIS HUD", preview: { bg: "#0a1224", fg: "#dff5ff", accent: "#22d3ee" } },
  { value: "minimalist", label: "Minimalist", hint: "Soft mono", preview: { bg: "#f6f5f1", fg: "#1a1a1a", accent: "#525252" } },
  { value: "amoled", label: "Neon AMOLED", hint: "Pure black + neon", preview: { bg: "#000000", fg: "#e6ffe6", accent: "#39ff14" } },
  { value: "abstract", label: "Abstract", hint: "Bold & artistic", preview: { bg: "#1a0b2e", fg: "#fde7ff", accent: "#ff3ea5" } },
];

const KEY = "sarvis_settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

const THEME_CLASSES = ["dark", "theme-minimalist", "theme-amoled", "theme-abstract"];

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  THEME_CLASSES.forEach((c) => root.classList.remove(c));
  switch (theme) {
    case "light":
      // no class — root vars
      break;
    case "dark":
      root.classList.add("dark");
      break;
    case "minimalist":
      root.classList.add("theme-minimalist");
      break;
    case "amoled":
      root.classList.add("theme-amoled");
      break;
    case "abstract":
      root.classList.add("theme-abstract");
      break;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
    applyTheme(settings.theme);
  }, [settings]);

  return [settings, setSettings] as const;
}
