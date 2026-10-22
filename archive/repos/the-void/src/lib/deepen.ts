import { createServerFn } from "@tanstack/react-start";

export type DeepenPayload = {
  month: string;
  pages: { title: string; body: string; kind: string }[];
  vessels: { kind: string; body: string }[];
  openTasks?: string[];
  tags?: string[];
};

export type DeepenOk = {
  ok: true;
  observation: string;
  missing: string;
  next: string;
  draftTitle?: string;
  draftBody?: string;
};

export type DeepenErr = { ok: false; error: string };

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export const deepenVoid = createServerFn({ method: "POST" })
  .validator((input: DeepenPayload) => ({
    month: String(input.month ?? "").slice(0, 40),
    pages: (input.pages ?? []).slice(0, 32).map((p) => ({
      title: clip(p.title, 80),
      body: clip(p.body, 400),
      kind: String(p.kind ?? "page").slice(0, 12),
    })),
    vessels: (input.vessels ?? []).slice(0, 16).map((v) => ({
      kind: String(v.kind ?? "note").slice(0, 16),
      body: clip(v.body, 160),
    })),
    openTasks: (input.openTasks ?? []).slice(0, 12).map((t) => clip(t, 80)),
    tags: (input.tags ?? []).slice(0, 16).map((t) => clip(t, 24)),
  }))
  .handler(async ({ data }): Promise<DeepenOk | DeepenErr> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "The void cannot speak here yet." };

    const inventory = [
      `Month: ${data.month}`,
      "Pages:",
      ...data.pages.map((p) => `- [${p.kind}] ${p.title}: ${p.body || "(empty)"}`),
      "In the room:",
      ...data.vessels.map((v) => `- ${v.kind}: ${v.body || "(empty)"}`),
      data.openTasks.length ? `Open tasks:\n${data.openTasks.map((t) => `- ${t}`).join("\n")}` : "Open tasks: none",
      data.tags.length ? `Tags: ${data.tags.join(", ")}` : "Tags: none",
    ].join("\n");

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 360,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are The Void, a spare editorial intelligence inside a monthly room for thinking. No cheerleading, no emoji, no marketing. Speak in short, concrete sentences. Return ONLY JSON with keys observation, missing, next, draftTitle, draftBody. observation: what is actually here. missing: one connection or page that should exist. next: one action the person can take in the next ten minutes. draftTitle/draftBody: optional page to create (empty strings if none).",
          },
          { role: "user", content: inventory || "The room is empty." },
        ],
      }),
    });

    if (!res.ok) return { ok: false, error: "The void did not answer." };

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content ?? "";
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) return { ok: false, error: "The void spoke unclearly." };

    try {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
      return {
        ok: true,
        observation: String(parsed.observation ?? "").slice(0, 280),
        missing: String(parsed.missing ?? "").slice(0, 220),
        next: String(parsed.next ?? "").slice(0, 220),
        draftTitle: parsed.draftTitle ? String(parsed.draftTitle).slice(0, 80) : undefined,
        draftBody: parsed.draftBody ? String(parsed.draftBody).slice(0, 600) : undefined,
      };
    } catch {
      return { ok: false, error: "The void spoke unclearly." };
    }
  });
