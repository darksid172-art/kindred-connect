import { supabase } from "@/integrations/supabase/client";

// ---------- Gmail ----------
export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}
export async function listGmail(max = 8): Promise<{ messages?: GmailMessage[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-gmail", {
    body: { action: "list", max },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { messages: data?.messages ?? [] };
}

// ---------- Calendar ----------
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  htmlLink?: string;
}
export async function listCalendar(days = 14): Promise<{ events?: CalendarEvent[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: { action: "list", days },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { events: data?.events ?? [] };
}
export async function createCalendarEvent(input: {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  reminderMinutes?: number;
}): Promise<{ event?: CalendarEvent; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: { action: "create", ...input },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { event: data?.event };
}

// ---------- Drive ----------
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}
export async function listDrive(query?: string): Promise<{ files?: DriveFile[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-drive", {
    body: { action: "list", query },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { files: data?.files ?? [] };
}
export async function uploadToDrive(file: File): Promise<{ file?: DriveFile; error?: string }> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  const { data, error } = await supabase.functions.invoke("google-drive", {
    body: { action: "upload", name: file.name, mimeType: file.type || "application/octet-stream", dataBase64 },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { file: data?.file };
}
export async function downloadFromDrive(fileId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("google-drive", {
    body: { action: "download", fileId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  const bin = atob(data.dataBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: data.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- YouTube ----------
export interface YouTubeChannel {
  id: string;
  title: string;
  thumbnail?: string;
  subscriberCount: number;
  subscriberHidden: boolean;
  viewCount: number;
  videoCount: number;
}
export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  channel: string;
  publishedAt: string;
  thumbnail: string;
}
export async function getYouTubeChannel(): Promise<{ channel?: YouTubeChannel; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-youtube", { body: { action: "channel" } });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { channel: data };
}
export async function searchYouTube(query: string, max = 6): Promise<{ videos?: YouTubeVideo[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-youtube", {
    body: { action: "search", query, max },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { videos: data?.videos ?? [] };
}

// ---------- Maps nearby ----------
export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lon: number;
  distance: number;
  osmUrl: string;
}
export async function findNearby(input: {
  lat: number;
  lon: number;
  category: string;
  radius?: number;
}): Promise<{ center?: { lat: number; lon: number }; category?: string; radius?: number; places?: NearbyPlace[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("maps-nearby", { body: input });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return data;
}
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return data;
}

// ---------- Intent parsing for chat ----------
export function parseNearbyIntent(text: string): { isNearby: boolean; category: string } {
  const m = text.match(/(?:find|show|where|search|locate)?\s*(?:me|some|the)?\s*([a-z\s]+?)\s+(?:near\s*me|nearby|around\s*me|close\s*to\s*me|near\s*by)\b/i);
  if (m) return { isNearby: true, category: m[1].trim() || "restaurant" };
  if (/\b(near\s*me|nearby|close\s*to\s*me)\b/i.test(text)) return { isNearby: true, category: "restaurant" };
  return { isNearby: false, category: "" };
}

export function parseDriveIntent(text: string): boolean {
  return /\b(google\s*drive|my\s*drive|drive\s*files|files\s*on\s*drive)\b/i.test(text);
}

export function parseCalendarIntent(text: string): boolean {
  return /\b(calendar|my\s*schedule|upcoming\s*events|events\s*today|agenda)\b/i.test(text);
}

export function parseGmailIntent(text: string): boolean {
  return /\b(gmail|my\s*emails?|inbox|new\s*mail|unread\s*emails?)\b/i.test(text);
}
