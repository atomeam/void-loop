export type VesselKind =
  | "note"
  | "intention"
  | "habit"
  | "quote"
  | "image"
  | "clock"
  | "page"
  | "task";

export type AtmosphereId = "still" | "tide" | "ember" | "gale" | "paper" | "hollow";

export type PlanId = "wander" | "keep" | "still";

export type WorkspaceView = "room" | "pages" | "graph" | "today" | "inbox";

export type PageKind = "page" | "daily" | "inbox" | "weekly";

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Vessel {
  id: string;
  kind: VesselKind;
  x: number;
  y: number;
  w: number;
  body: string;
  habit: boolean[];
  checks: CheckItem[];
  pageId?: string;
  src?: string;
  z: number;
}

export interface PageSnapshot {
  at: string;
  title: string;
  body: string;
}

export interface Page {
  id: string;
  title: string;
  body: string;
  kind: PageKind;
  day?: string;
  week?: string;
  pinned: boolean;
  aliases: string[];
  snapshots: PageSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface DeepenResult {
  observation: string;
  missing: string;
  next: string;
  draftTitle?: string;
  draftBody?: string;
  at: string;
}

export interface DeepenState {
  day: string;
  count: number;
  last: DeepenResult | null;
}

export interface MonthRecord {
  id: string;
  name: string;
  atmosphere: AtmosphereId;
  density: number;
  vessels: Vessel[];
  sealedAt: string | null;
  createdAt: string;
}

export interface Atmosphere {
  id: AtmosphereId;
  label: string;
  line: string;
  src: string;
}

export const ATMOSPHERES: Atmosphere[] = [
  { id: "still", label: "Still", line: "A room with one window.", src: "/atmospheres/still.jpg" },
  { id: "tide", label: "Tide", line: "Water that does not hurry.", src: "/atmospheres/tide.jpg" },
  { id: "ember", label: "Ember", line: "Heat after the fire.", src: "/atmospheres/ember.jpg" },
  { id: "gale", label: "Gale", line: "Mist moving across stone.", src: "/atmospheres/gale.jpg" },
  { id: "paper", label: "Paper", line: "Fiber, ink, quiet.", src: "/atmospheres/paper.jpg" },
  { id: "hollow", label: "Hollow", line: "Coast, fog, almost nothing.", src: "/atmospheres/hollow.jpg" },
];

export const VESSEL_META: Record<
  VesselKind,
  { label: string; hint: string; defaultW: number; defaultBody: string }
> = {
  note: { label: "Note", hint: "A scrap of thought.", defaultW: 220, defaultBody: "" },
  intention: { label: "Intention", hint: "One line for the day.", defaultW: 280, defaultBody: "" },
  habit: { label: "Habit", hint: "Seven days. No streak theater.", defaultW: 240, defaultBody: "Sit before the phone" },
  quote: { label: "Quote", hint: "Words you want in the room.", defaultW: 260, defaultBody: "" },
  image: { label: "Image", hint: "A photograph you keep this month.", defaultW: 220, defaultBody: "" },
  clock: { label: "Clock", hint: "The only time that matters is now.", defaultW: 180, defaultBody: "" },
  page: { label: "Page", hint: "A lasting note. [[Link]] it.", defaultW: 260, defaultBody: "" },
  task: { label: "Task", hint: "A list that can be finished.", defaultW: 240, defaultBody: "" },
};

export const WANDER_VESSEL_LIMIT = 8;
export const WANDER_PAGE_LIMIT = 32;
export const DEEPEN_DAILY_CAP = 4;

export const PLANS: Record<
  PlanId,
  { name: string; price: string; cadence: string; points: string[]; cta: string }
> = {
  wander: {
    name: "Wander",
    price: "0",
    cadence: "free",
    points: [
      "The room, immediately",
      "Eight vessels this month",
      "Thirty-two pages, wiki links, graph",
      "Today harvests every open task",
      "Command palette, templates, export",
    ],
    cta: "Stay on Wander",
  },
  keep: {
    name: "Keep",
    price: "9",
    cadence: "month",
    points: [
      "Unlimited pages and vessels",
      "Image uploads",
      "Every sealed month kept",
      "The void deepens with you",
    ],
    cta: "Unlock Keep",
  },
  still: {
    name: "Still",
    price: "72",
    cadence: "year",
    points: ["Everything in Keep", "Two months free", "Export a month as a still"],
    cta: "Unlock Still",
  },
};
