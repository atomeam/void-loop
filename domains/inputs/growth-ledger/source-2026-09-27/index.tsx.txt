import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import type { LedgerEntry } from "@/server/ledger.server";

const loadLedger = createServerFn({ method: "GET" }).handler(async () => {
  const { listEntries } = await import("@/server/ledger.server");
  return listEntries();
});

export const Route = createFileRoute("/")({
  loader: () => loadLedger(),
  component: Home,
});

function Home() {
  const entries = Route.useLoaderData();
  const proven = entries.filter((row) => row.status === "PROVEN").length;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="border-b border-rule pb-6">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">A-to-Mind · append-only</p>
        <h1 className="mt-2 text-4xl leading-tight font-medium text-ink">Growth Ledger</h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">
          Hours land as candidates. A human types ATTEST to promote one. Nothing here is a published offer until that happens.
        </p>
        <dl className="mt-5 flex flex-wrap gap-6 font-mono text-xs text-muted">
          <div>
            <dt>Proven atoms</dt>
            <dd className="mt-1 text-base text-proven">{proven}</dd>
          </div>
          <div>
            <dt>Hours on file</dt>
            <dd className="mt-1 text-base text-ink">{entries.length}</dd>
          </div>
          <div>
            <dt>Public vault</dt>
            <dd className="mt-1 text-base text-stamp">empty</dd>
          </div>
        </dl>
      </header>

      <section className="mt-8 rounded-lg border border-rule bg-card p-4 sm:p-5">
        <h2 className="font-mono text-xs tracking-widest text-stamp uppercase">Retrieval</h2>
        <p className="mt-2 leading-relaxed text-ink">
          GET a-to-mind.com/api/memory/context returned the Void HTML shell, not a JSON vault. No PROVEN atoms to quote. This console is the ledger for the next hour.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">Hours</h2>
        {entries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-rule bg-card p-5 text-muted">
            No hours yet. Paste a brief into the ingest bay. Prior hours are never overwritten.
          </p>
        ) : (
          <ol className="mt-4 space-y-6">
            {entries.map((entry) => (
              <Hour key={entry.content_hash} entry={entry} />
            ))}
          </ol>
        )}
      </section>

      <IngestBay />
    </main>
  );
}

function Hour({ entry }: { entry: LedgerEntry }) {
  const play = entry.payload.profit_play;
  const site = entry.payload.website_update;
  const proven = entry.status === "PROVEN";
  return (
    <li className="rounded-lg border border-rule bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`font-mono text-xs tracking-widest uppercase ${proven ? "text-proven" : "text-stamp"}`}>
          {entry.status}
        </p>
        <p className="font-mono text-xs text-muted">{entry.content_hash.slice(0, 16)}</p>
      </div>
      <h3 className="mt-3 text-2xl leading-snug font-medium">{play.name}</h3>
      <p className="mt-1 font-mono text-sm text-ink">{play.price}</p>
      <p className="mt-3 leading-relaxed text-muted">{play.why_today}</p>
      <p className="mt-3 text-sm text-ink">
        <span className="font-mono text-xs tracking-widest text-muted uppercase">Buyer · </span>
        {play.buyer}
      </p>

      <div className="mt-5 border-t border-rule pt-4">
        <p className="font-mono text-xs tracking-widest text-stamp uppercase">Website draft · not live</p>
        <h4 className="mt-2 text-xl leading-snug">{site.headline}</h4>
        <p className="mt-2 leading-relaxed text-muted">{site.subhead}</p>
        <ul className="mt-3 space-y-1 text-ink">
          {site.value_props.map((prop) => (
            <li key={prop} className="border-l-2 border-rule pl-3">
              {prop}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-sm text-muted">
          {site.offer_name} · {site.price} · {site.cta}
        </p>
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">For the next hour</p>
        <p className="mt-2 leading-relaxed">{entry.payload.memory_update.synthesis}</p>
      </div>

      {proven ? (
        <p className="mt-4 font-mono text-xs text-proven">Attested {entry.attested_at}</p>
      ) : (
        <AttestForm hash={entry.content_hash} />
      )}
    </li>
  );
}

function AttestForm({ hash }: { hash: string }) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, phrase }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Attest failed");
        return;
      }
      setPhrase("");
      await router.invalidate();
    } catch {
      setError("Attest failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1 text-sm text-muted">
        Human gate
        <input
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          placeholder="Type ATTEST"
          autoComplete="off"
          className="mt-1 min-h-11 w-full rounded-md border border-rule bg-paper px-3 font-mono text-ink outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending || phrase !== "ATTEST"}
        className="min-h-11 rounded-md bg-ink px-4 text-paper disabled:opacity-40"
      >
        {pending ? "Sealing…" : "Attest hour"}
      </button>
      {error ? <p className="text-sm text-stamp sm:basis-full">{error}</p> : null}
    </form>
  );
}

function IngestBay() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNote("");
    try {
      const parsed = JSON.parse(raw) as unknown;
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; idempotent?: boolean; content_hash?: string };
      if (!res.ok || !data.ok) {
        setNote(data.error ?? "Ingest rejected");
        return;
      }
      setRaw("");
      setNote(data.idempotent ? `Already on file ${data.content_hash?.slice(0, 12)}` : `Filed ${data.content_hash?.slice(0, 12)} as CANDIDATE`);
      await router.invalidate();
    } catch {
      setNote("Paste a JSON object matching the ingest schema.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-10 border-t border-rule pt-8">
      <h2 className="font-mono text-xs tracking-widest text-muted uppercase">Ingest bay</h2>
      <p className="mt-2 text-muted">Append one hour. Same content hashes to the same row and is not written twice.</p>
      <form onSubmit={onSubmit} className="mt-4">
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={8}
          spellCheck={false}
          placeholder='{"pulse":{...},"profit_play":{...},"engineering":{...},"website_update":{...},"memory_update":{...}}'
          className="min-h-40 w-full rounded-md border border-rule bg-bay p-3 font-mono text-sm leading-relaxed text-ink outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || raw.trim().length === 0}
            className="min-h-11 rounded-md bg-stamp px-4 text-card disabled:opacity-40"
          >
            {pending ? "Filing…" : "Append hour"}
          </button>
          {note ? <p className="text-sm text-ink">{note}</p> : null}
        </div>
      </form>
    </section>
  );
}
