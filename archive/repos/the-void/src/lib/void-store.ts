import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ATMOSPHERES,
  DEEPEN_DAILY_CAP,
  WANDER_PAGE_LIMIT,
  WANDER_VESSEL_LIMIT,
  type AtmosphereId,
  type DeepenResult,
  type DeepenState,
  type MonthRecord,
  type Page,
  type PageKind,
  type PageSnapshot,
  type PlanId,
  type Vessel,
  type VesselKind,
  VESSEL_META,
} from "@/lib/void-types";
import { PAGE_TEMPLATES, type TemplateId, weekId, weekLabel } from "@/lib/mind";
import { monthId, monthLabel, uid } from "@/lib/utils";
import { extractTasks, dayId, dayLabel, findPageByTitle, slugTitle } from "@/lib/wiki";

function emptyMonth(id = monthId(), atmosphere: AtmosphereId = "still"): MonthRecord {
  return {
    id,
    name: monthLabel(id),
    atmosphere,
    density: 0.45,
    vessels: [],
    sealedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function nextZ(vessels: Vessel[]) {
  return vessels.reduce((m, v) => Math.max(m, v.z), 0) + 1;
}

function normalizePage(p: Partial<Page> & Pick<Page, "id" | "title">): Page {
  const now = new Date().toISOString();
  return {
    id: p.id,
    title: slugTitle(p.title) || "Untitled",
    body: p.body ?? "",
    kind: p.kind ?? "page",
    day: p.day,
    week: p.week,
    pinned: p.pinned ?? false,
    aliases: Array.isArray(p.aliases) ? p.aliases : [],
    snapshots: Array.isArray(p.snapshots) ? p.snapshots.slice(0, 5) : [],
    createdAt: p.createdAt ?? now,
    updatedAt: p.updatedAt ?? now,
  };
}

function makePage(partial: Partial<Page> & { title: string; kind?: PageKind }): Page {
  return normalizePage({
    id: partial.id ?? uid(),
    title: partial.title,
    body: partial.body ?? "",
    kind: partial.kind ?? "page",
    day: partial.day,
    week: partial.week,
    pinned: partial.pinned,
    aliases: partial.aliases,
    snapshots: partial.snapshots,
    createdAt: partial.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

function snapshotOf(page: Page): PageSnapshot {
  return {
    at: page.updatedAt,
    title: page.title,
    body: page.body.slice(0, 4000),
  };
}

function withSnapshot(existing: Page, patch: Partial<Pick<Page, "title" | "body" | "pinned" | "aliases">>): Page {
  const bodyChanged = patch.body !== undefined && patch.body !== existing.body;
  const titleChanged = patch.title !== undefined && slugTitle(patch.title) !== existing.title;
  let snapshots = existing.snapshots ?? [];
  if (bodyChanged || titleChanged) {
    const last = snapshots[0];
    const recent = last && Date.now() - new Date(last.at).getTime() < 20_000;
    if (!recent && (existing.body.trim() || existing.title !== "Untitled")) {
      snapshots = [snapshotOf(existing), ...snapshots].slice(0, 5);
    }
  }
  return {
    ...existing,
    ...patch,
    title: patch.title !== undefined ? slugTitle(patch.title) || existing.title : existing.title,
    aliases: patch.aliases ?? existing.aliases,
    snapshots,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeVessel(v: Partial<Vessel> & Pick<Vessel, "id" | "kind" | "x" | "y">): Vessel {
  return {
    id: v.id,
    kind: v.kind,
    x: v.x,
    y: v.y,
    w: v.w ?? VESSEL_META[v.kind]?.defaultW ?? 220,
    body: v.body ?? "",
    habit: v.habit ?? Array.from({ length: 7 }, () => false),
    checks: v.checks ?? [],
    pageId: v.pageId,
    src: v.src,
    z: v.z ?? 1,
  };
}

const SYSTEM_KINDS: PageKind[] = ["daily", "inbox", "weekly"];

export interface VoidState {
  hydrated: boolean;
  entered: boolean;
  plan: PlanId;
  current: MonthRecord;
  archives: MonthRecord[];
  pages: Page[];
  recents: string[];
  deepen: DeepenState;
  markHydrated: () => void;
  setEntered: () => void;
  setPlan: (plan: PlanId) => void;
  setName: (name: string) => void;
  setAtmosphere: (id: AtmosphereId) => void;
  setDensity: (n: number) => void;
  addVessel: (kind: VesselKind, x: number, y: number, extras?: Partial<Vessel>) => string | null;
  updateVessel: (id: string, patch: Partial<Vessel>) => void;
  moveVessel: (id: string, x: number, y: number) => void;
  removeVessel: (id: string) => void;
  bringFront: (id: string) => void;
  toggleHabit: (id: string, day: number) => void;
  toggleCheck: (vesselId: string, checkId: string) => void;
  addCheck: (vesselId: string, text?: string) => void;
  updateCheck: (vesselId: string, checkId: string, text: string) => void;
  sealMonth: () => void;
  openFresh: () => void;
  restoreArchive: (id: string) => void;
  ensureMonth: () => void;
  canAdd: () => boolean;
  canAddPage: () => boolean;
  upsertPage: (partial: Partial<Page> & { title: string; kind?: PageKind }) => Page;
  updatePage: (id: string, patch: Partial<Pick<Page, "title" | "body" | "pinned" | "aliases">>) => void;
  removePage: (id: string) => void;
  ensureToday: () => Page;
  ensureInbox: () => Page;
  ensureWeek: () => Page;
  capture: (text: string) => void;
  keepInboxLine: (index: number) => Page | null;
  openOrCreateByTitle: (title: string) => Page;
  placePageInRoom: (pageId: string) => string | null;
  recordDeepen: (result: DeepenResult) => void;
  deepenAllowed: () => boolean;
  touchPage: (id: string) => void;
  applyTemplate: (id: string, templateId: TemplateId) => void;
  restoreSnapshot: (id: string, at: string) => void;
}

export const useVoidStore = create<VoidState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      entered: false,
      plan: "wander",
      current: emptyMonth(),
      archives: [],
      pages: [],
      recents: [],
      deepen: { day: "", count: 0, last: null },
      markHydrated: () => set({ hydrated: true }),
      setEntered: () => set({ entered: true }),
      setPlan: (plan) => set({ plan }),
      setName: (name) => set({ current: { ...get().current, name } }),
      setAtmosphere: (atmosphere) => set({ current: { ...get().current, atmosphere } }),
      setDensity: (density) => set({ current: { ...get().current, density } }),
      canAdd: () => {
        const { plan, current } = get();
        if (plan !== "wander") return true;
        return current.vessels.length < WANDER_VESSEL_LIMIT;
      },
      canAddPage: () => {
        const { plan, pages } = get();
        if (plan !== "wander") return true;
        const durable = pages.filter((p) => !SYSTEM_KINDS.includes(p.kind)).length;
        return durable < WANDER_PAGE_LIMIT;
      },
      addVessel: (kind, x, y, extras) => {
        const { current, canAdd, upsertPage, canAddPage } = get();
        if (current.sealedAt) return null;
        if (!canAdd()) return null;
        const meta = VESSEL_META[kind];
        let pageId = extras?.pageId;
        let body = extras?.body ?? meta.defaultBody;
        if (kind === "page") {
          if (!canAddPage() && !pageId) return null;
          const page = pageId
            ? get().pages.find((p) => p.id === pageId)
            : upsertPage({ title: body.trim() || "Untitled", body: "", kind: "page" });
          if (!page) return null;
          pageId = page.id;
          body = page.title;
        }
        const vessel = normalizeVessel({
          id: uid(),
          kind,
          x,
          y,
          w: extras?.w ?? meta.defaultW,
          body,
          habit: extras?.habit,
          checks:
            extras?.checks ??
            (kind === "task" ? [{ id: uid(), text: "", done: false }] : []),
          pageId,
          src: extras?.src,
          z: nextZ(current.vessels),
        });
        set({ current: { ...current, vessels: [...current.vessels, vessel] } });
        return vessel.id;
      },
      updateVessel: (id, patch) => {
        const { current, updatePage } = get();
        const target = current.vessels.find((v) => v.id === id);
        set({
          current: {
            ...current,
            vessels: current.vessels.map((v) => (v.id === id ? { ...v, ...patch } : v)),
          },
        });
        if (target?.pageId && patch.body !== undefined) {
          updatePage(target.pageId, { title: patch.body });
        }
      },
      moveVessel: (id, x, y) => {
        const { current } = get();
        set({
          current: {
            ...current,
            vessels: current.vessels.map((v) => (v.id === id ? { ...v, x, y } : v)),
          },
        });
      },
      removeVessel: (id) => {
        const { current } = get();
        set({
          current: { ...current, vessels: current.vessels.filter((v) => v.id !== id) },
        });
      },
      bringFront: (id) => {
        const { current } = get();
        const z = nextZ(current.vessels);
        set({
          current: {
            ...current,
            vessels: current.vessels.map((v) => (v.id === id ? { ...v, z } : v)),
          },
        });
      },
      toggleHabit: (id, day) => {
        const { current } = get();
        set({
          current: {
            ...current,
            vessels: current.vessels.map((v) => {
              if (v.id !== id) return v;
              const habit = [...v.habit];
              habit[day] = !habit[day];
              return { ...v, habit };
            }),
          },
        });
      },
      toggleCheck: (vesselId, checkId) => {
        const { current } = get();
        set({
          current: {
            ...current,
            vessels: current.vessels.map((v) =>
              v.id === vesselId
                ? {
                    ...v,
                    checks: v.checks.map((c) => (c.id === checkId ? { ...c, done: !c.done } : c)),
                  }
                : v,
            ),
          },
        });
      },
      addCheck: (vesselId, text = "") => {
        const { current } = get();
        set({
          current: {
            ...current,
            vessels: current.vessels.map((v) =>
              v.id === vesselId
                ? { ...v, checks: [...v.checks, { id: uid(), text, done: false }] }
                : v,
            ),
          },
        });
      },
      updateCheck: (vesselId, checkId, text) => {
        const { current } = get();
        set({
          current: {
            ...current,
            vessels: current.vessels.map((v) =>
              v.id === vesselId
                ? { ...v, checks: v.checks.map((c) => (c.id === checkId ? { ...c, text } : c)) }
                : v,
            ),
          },
        });
      },
      sealMonth: () => {
        const { current, archives } = get();
        if (current.vessels.length === 0) return;
        const sealed: MonthRecord = {
          ...current,
          sealedAt: new Date().toISOString(),
        };
        const next = emptyMonth(monthId(), current.atmosphere);
        set({
          current: next,
          archives: [sealed, ...archives.filter((a) => a.id !== sealed.id)],
        });
      },
      openFresh: () => {
        const { current, archives } = get();
        if (current.vessels.length > 0 && !current.sealedAt) {
          const sealed = { ...current, sealedAt: new Date().toISOString() };
          set({
            archives: [sealed, ...archives.filter((a) => a.id !== sealed.id)],
            current: emptyMonth(monthId(), current.atmosphere),
          });
          return;
        }
        set({ current: emptyMonth(monthId(), current.atmosphere) });
      },
      restoreArchive: (id) => {
        const { archives, current } = get();
        const found = archives.find((a) => a.id === id);
        if (!found) return;
        const rest = archives.filter((a) => a.id !== id);
        const stash =
          current.vessels.length > 0
            ? [{ ...current, sealedAt: current.sealedAt ?? new Date().toISOString() }, ...rest]
            : rest;
        set({
          current: {
            ...found,
            vessels: found.vessels.map((v) => normalizeVessel(v)),
            sealedAt: null,
            id: monthId(),
            name: found.name,
          },
          archives: stash,
        });
      },
      ensureMonth: () => {
        const { current, archives } = get();
        const now = monthId();
        if (current.id === now) return;
        if (current.vessels.length > 0) {
          const sealed = { ...current, sealedAt: current.sealedAt ?? new Date().toISOString() };
          set({
            archives: [sealed, ...archives.filter((a) => a.id !== sealed.id)],
            current: emptyMonth(now, current.atmosphere),
          });
        } else {
          set({ current: { ...current, id: now, name: monthLabel(now) } });
        }
      },
      upsertPage: (partial) => {
        const { pages, canAddPage } = get();
        const existing = partial.id
          ? pages.find((p) => p.id === partial.id)
          : findPageByTitle(pages, partial.title);
        if (existing) {
          const next = withSnapshot(existing, {
            title: partial.title,
            body: partial.body,
            pinned: partial.pinned,
            aliases: partial.aliases,
          });
          set({ pages: pages.map((p) => (p.id === existing.id ? next : p)) });
          return next;
        }
        const isSystem = SYSTEM_KINDS.includes(partial.kind ?? "page");
        if (!canAddPage() && !isSystem) {
          return pages[0] ?? makePage(partial);
        }
        const page = makePage(partial);
        set({ pages: [page, ...pages] });
        return page;
      },
      updatePage: (id, patch) => {
        const { pages, current } = get();
        set({
          pages: pages.map((p) => (p.id === id ? withSnapshot(p, patch) : p)),
          current: {
            ...current,
            vessels: current.vessels.map((v) =>
              v.pageId === id && patch.title !== undefined ? { ...v, body: slugTitle(patch.title) } : v,
            ),
          },
        });
      },
      removePage: (id) => {
        const { pages, current, recents } = get();
        set({
          pages: pages.filter((p) => p.id !== id),
          recents: recents.filter((r) => r !== id),
          current: {
            ...current,
            vessels: current.vessels.filter((v) => v.pageId !== id),
          },
        });
      },
      ensureToday: () => {
        const { pages, upsertPage } = get();
        const day = dayId();
        const found = pages.find((p) => p.kind === "daily" && p.day === day);
        if (found) return found;
        return upsertPage({
          title: dayLabel(day),
          kind: "daily",
          day,
          body: `# ${dayLabel(day)}\n\n- [ ] \n\n`,
        });
      },
      ensureInbox: () => {
        const { pages, upsertPage } = get();
        const found = pages.find((p) => p.kind === "inbox");
        if (found) return found;
        return upsertPage({ title: "Inbox", kind: "inbox", body: "" });
      },
      ensureWeek: () => {
        const { pages, upsertPage } = get();
        const week = weekId();
        const found = pages.find((p) => p.kind === "weekly" && p.week === week);
        if (found) return found;
        const tmpl = PAGE_TEMPLATES.find((t) => t.id === "week");
        return upsertPage({
          title: weekLabel(week),
          kind: "weekly",
          week,
          body: tmpl?.body ?? "",
        });
      },
      capture: (text) => {
        const line = text.trim();
        if (!line) return;
        const inbox = get().ensureInbox();
        const prefix = inbox.body.trim() ? `${inbox.body.trim()}\n` : "";
        get().updatePage(inbox.id, { body: `${prefix}- [ ] ${line}` });
      },
      keepInboxLine: (index) => {
        const inbox = get().ensureInbox();
        const task = extractTasks(inbox.body).find((t) => t.index === index);
        if (!task || !task.text.trim()) return null;
        if (!get().canAddPage()) return null;
        const title = slugTitle(task.text).slice(0, 72) || "Untitled";
        const page = get().openOrCreateByTitle(title);
        if (!page.body.trim()) {
          get().updatePage(page.id, { body: `# ${page.title}\n\nFrom Inbox.\n` });
        }
        const lines = inbox.body.split("\n");
        lines[index] = `- [x] [[${page.title}]]`;
        get().updatePage(inbox.id, { body: lines.join("\n") });
        get().touchPage(page.id);
        return get().pages.find((p) => p.id === page.id) ?? page;
      },
      openOrCreateByTitle: (title) => {
        const { pages, upsertPage } = get();
        return findPageByTitle(pages, title) ?? upsertPage({ title, kind: "page", body: "" });
      },
      placePageInRoom: (pageId) => {
        const { pages, current, addVessel } = get();
        const page = pages.find((p) => p.id === pageId);
        if (!page) return null;
        const existing = current.vessels.find((v) => v.pageId === pageId);
        if (existing) return existing.id;
        const n = current.vessels.length;
        const x = 18 + ((n * 17) % 60);
        const y = 22 + ((n * 13) % 50);
        return addVessel("page", x, y, { pageId, body: page.title });
      },
      recordDeepen: (result) => {
        const day = dayId();
        const { deepen } = get();
        const count = deepen.day === day ? deepen.count + 1 : 1;
        set({ deepen: { day, count, last: result } });
      },
      deepenAllowed: () => {
        const { deepen, plan } = get();
        const cap = plan === "wander" ? DEEPEN_DAILY_CAP : 12;
        const day = dayId();
        if (deepen.day !== day) return true;
        return deepen.count < cap;
      },
      touchPage: (id) => {
        const { recents } = get();
        set({ recents: [id, ...recents.filter((r) => r !== id)].slice(0, 16) });
      },
      applyTemplate: (id, templateId) => {
        const tmpl = PAGE_TEMPLATES.find((t) => t.id === templateId);
        const page = get().pages.find((p) => p.id === id);
        if (!tmpl || !page) return;
        const next = page.body.trim() ? `${page.body.trim()}\n\n${tmpl.body}` : tmpl.body;
        get().updatePage(id, { body: next });
      },
      restoreSnapshot: (id, at) => {
        const page = get().pages.find((p) => p.id === id);
        const snap = page?.snapshots.find((s) => s.at === at);
        if (!page || !snap) return;
        get().updatePage(id, { title: snap.title, body: snap.body });
      },
    }),
    {
      name: "the-void-v1",
      partialize: (s) => ({
        entered: s.entered,
        plan: s.plan,
        current: s.current,
        archives: s.archives,
        pages: s.pages,
        recents: s.recents,
        deepen: s.deepen,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<VoidState>;
        const vessels = (p.current?.vessels ?? current.current.vessels).map((v) =>
          normalizeVessel(v as Vessel),
        );
        return {
          ...current,
          ...p,
          current: { ...current.current, ...p.current, vessels },
          pages: Array.isArray(p.pages)
            ? p.pages.map((page) => normalizePage(page as Page))
            : [],
          recents: Array.isArray(p.recents) ? p.recents : [],
          deepen: p.deepen ?? current.deepen,
          archives: (p.archives ?? []).map((m) => ({
            ...m,
            vessels: (m.vessels ?? []).map((v) => normalizeVessel(v as Vessel)),
          })),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.ensureMonth();
        state?.markHydrated();
      },
    },
  ),
);

export function atmosphereOf(id: AtmosphereId) {
  return ATMOSPHERES.find((a) => a.id === id) ?? ATMOSPHERES[0];
}
