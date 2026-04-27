// Personalized startup briefing for SARVIS.
// Pulls news, unread emails, YouTube stats, calendar, and weather, then
// builds a single greeting message. Computes deltas vs the previous snapshot
// so SARVIS can say things like "+12 new subscribers since yesterday".

import { getNews, getWeather } from "@/lib/sarvis";
import { listGmail, listCalendar, getYouTubeAnalytics, markGmailRead } from "@/lib/google";
import type { AppSettings, BriefingSnapshot, UserProfile } from "@/lib/settings";

export interface BriefingResult {
  text: string;
  newSnapshot: BriefingSnapshot;
  markedReadIds: string[];
}

function greetingForHour(name?: string): string {
  const h = new Date().getHours();
  const tod = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${tod}, ${name}` : `${tod}, sir`;
}

export async function buildStartupBriefing(
  settings: AppSettings,
): Promise<BriefingResult> {
  const profile: UserProfile | undefined = settings.userProfile;
  const sections: string[] = [];
  const prev = settings.lastBriefing;
  const newSnapshot: BriefingSnapshot = { at: Date.now() };
  const markedReadIds: string[] = [];

  sections.push(`# ${greetingForHour(profile?.name)}.`);
  sections.push("Here is your briefing:");

  // ---- YouTube channel deltas ----
  try {
    const yt = await getYouTubeAnalytics();
    if (yt.analytics) {
      const a = yt.analytics;
      newSnapshot.subscriberCount = a.channel.subscriberCount;
      newSnapshot.totalViews = a.channel.viewCount;
      const top = a.top[0];
      if (top) {
        newSnapshot.topVideoId = top.videoId;
        newSnapshot.topVideoViews = top.views;
      }
      const subDelta = prev?.subscriberCount != null
        ? a.channel.subscriberCount - prev.subscriberCount
        : null;
      const viewDelta = prev?.totalViews != null
        ? a.channel.viewCount - prev.totalViews
        : null;
      const lines: string[] = [`## 📺 YouTube — ${a.channel.title}`];
      if (subDelta != null && subDelta > 0) {
        lines.push(`🎉 **Congratulations** — you have **${subDelta.toLocaleString()} new subscribers** since last visit (${a.channel.subscriberCount.toLocaleString()} total).`);
      } else if (subDelta != null && subDelta < 0) {
        lines.push(`Subscribers: **${a.channel.subscriberCount.toLocaleString()}** (${subDelta} since last visit).`);
      } else {
        lines.push(`Subscribers: **${a.channel.subscriberCount.toLocaleString()}**.`);
      }
      if (viewDelta != null && viewDelta > 0) {
        lines.push(`Total views are up by **${viewDelta.toLocaleString()}** (${a.channel.viewCount.toLocaleString()} all-time).`);
      }
      if (top && prev?.topVideoId === top.videoId && prev.topVideoViews != null) {
        const delta = top.views - prev.topVideoViews;
        if (delta > 0) {
          lines.push(`Your top video **"${top.title}"** picked up **${delta.toLocaleString()} more views** — better than last time.`);
        }
      } else if (top) {
        lines.push(`Top recent video: **"${top.title}"** — ${top.views.toLocaleString()} views.`);
      }
      sections.push(lines.join("\n"));
    }
  } catch {
    // YouTube optional — silently skip
  }

  // ---- Unread Gmail summary + auto-mark-read ----
  try {
    const gmail = await listGmail(8, "is:unread");
    if (gmail.messages && gmail.messages.length > 0) {
      const lines = [`## ✉️ Unread emails (${gmail.messages.length})`];
      for (const m of gmail.messages.slice(0, 6)) {
        const sender = m.from.split("<")[0].trim() || m.from;
        lines.push(`- **${sender}** — ${m.subject}\n  _${m.snippet.slice(0, 140)}_`);
      }
      // Flag concerning ones (urgency keywords)
      const concerning = gmail.messages.filter((m) =>
        /\b(urgent|asap|action required|invoice|payment|overdue|security|verify|password|locked|suspended|deadline|important)\b/i.test(
          `${m.subject} ${m.snippet}`,
        ),
      );
      if (concerning.length > 0) {
        lines.push(`\n⚠️ **${concerning.length} email${concerning.length === 1 ? "" : "s"} look concerning** — check the senders above.`);
      }
      sections.push(lines.join("\n"));

      if (settings.emailAutoMarkRead) {
        const ids = gmail.messages.map((m) => m.id);
        const r = await markGmailRead(ids);
        if (r.ok) {
          markedReadIds.push(...ids);
          sections.push(`_(Marked ${ids.length} email${ids.length === 1 ? "" : "s"} as read after summarizing.)_`);
        }
      }
    }
  } catch {
    // Gmail optional
  }

  // ---- News for the user's country (or top headlines) ----
  try {
    const country = profile?.country || undefined;
    const news = await getNews({ country, pageSize: 5 });
    if (news.articles && news.articles.length > 0) {
      const lines = [`## 📰 News${country ? ` (${country.toUpperCase()})` : ""}`];
      for (const a of news.articles.slice(0, 5)) {
        lines.push(`- [${a.title}](${a.url}) — _${a.source}_`);
      }
      sections.push(lines.join("\n"));
    }
  } catch {
    // News optional
  }

  // ---- Weather (Open-Meteo, no key needed) ----
  try {
    const cc = (profile?.country || "").trim();
    if (cc) {
      const w = await getWeather({ place: cc });
      if (w.forecast) {
        const f = w.forecast;
        const today = f.days[0];
        const tomorrow = f.days[1];
        const lines = [`## ☀️ Weather${f.place ? ` — ${f.place}` : ""}`];
        lines.push(
          `Now: **${Math.round(f.current.temp)}°C** · ${f.current.summary} · feels ${Math.round(f.current.feelsLike)}°C · 💧${f.current.humidity}% · 🌬 ${Math.round(f.current.wind)} km/h`,
        );
        if (today) {
          lines.push(`Today: ${today.summary} · ${Math.round(today.tMin)}°–${Math.round(today.tMax)}°C · rain ${today.pop}%`);
        }
        if (tomorrow) {
          lines.push(`Tomorrow: ${tomorrow.summary} · ${Math.round(tomorrow.tMin)}°–${Math.round(tomorrow.tMax)}°C · rain ${tomorrow.pop}%`);
        }
        if (today && today.pop >= 70) {
          lines.push(`☔ **Heads up — high chance of rain today (${today.pop}%).** Carry an umbrella.`);
        } else if ((today?.tMax ?? 0) >= 32) {
          lines.push(`🥵 **It'll be hot — up to ${Math.round(today.tMax)}°C. Stay hydrated.**`);
        }
        sections.push(lines.join("\n"));
      }
    }
  } catch {
    // Weather optional
  }

  // ---- Calendar (today + tomorrow) ----
  try {
    const cal = await listCalendar(2);
    if (cal.events && cal.events.length > 0) {
      const lines = ["## 📅 Upcoming"];
      for (const e of cal.events.slice(0, 5)) {
        lines.push(`- **${e.summary}** — ${new Date(e.start).toLocaleString()}`);
      }
      sections.push(lines.join("\n"));
    }
  } catch {
    // Calendar optional
  }

  sections.push("\n_Ask me anything — try 'what's the weather', 'read my emails', 'open chrome', or 'shutdown my pc'._");

  return {
    text: sections.join("\n\n"),
    newSnapshot,
    markedReadIds,
  };
}
