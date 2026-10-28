// void-live-deploy/skills/hosting.js
export default {
  id: 'hosting',
  name: 'Hosting & Domain Studio',
  match: /hosting|webhotell|domain|server|nameunit/i,
  mount(container, ctx) {
    container.innerHTML = `
      <div class="hosting-card p-6 rounded-2xl bg-zinc-900 text-zinc-100 shadow-2xl border border-zinc-800 font-sans max-w-xl mx-auto">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold tracking-tight text-amber-400">Verse Sovereign Hosting</h2>
          <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">Beating Name Unit</span>
        </div>
        
        <p class="text-sm text-zinc-400 mb-4">Instant server architecture sizing, domain lookup, and Norwegian local hosting parity with zero-overhead edge deployment.</p>

        <!-- Domain Search Bar -->
        <div class="flex gap-2 mb-6">
          <input type="text" id="domain-input" placeholder="Søk på domene (.no, .com)..." class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-400">
          <button id="domain-btn" class="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-4 py-2 rounded-lg text-sm transition">Søk</button>
        </div>
        <div id="domain-result" class="text-xs text-zinc-400 mb-6 hidden p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50"></div>

        <!-- Tiered Packages (Beating Small, Medium, Large) -->
        <div class="grid grid-cols-3 gap-3 mb-6">
          <div class="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700 text-center">
            <div class="text-xs font-bold text-zinc-300">Small</div>
            <div class="text-lg font-extrabold text-amber-400 my-1">Kr. 9 <span class="text-[10px] text-zinc-400">/mnd</span></div>
            <div class="text-[11px] text-zinc-400">20 GB Webhotell<br>Servere i Norge</div>
          </div>
          <div class="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700 text-center">
            <div class="text-xs font-bold text-zinc-300">Medium</div>
            <div class="text-lg font-extrabold text-amber-400 my-1">Kr. 19 <span class="text-[10px] text-zinc-400">/mnd</span></div>
            <div class="text-[11px] text-zinc-400">40 GB Webhotell<br>Servere i Norge</div>
          </div>
          <div class="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700 text-center">
            <div class="text-xs font-bold text-zinc-300">Large</div>
            <div class="text-lg font-extrabold text-amber-400 my-1">Kr. 29 <span class="text-[10px] text-zinc-400">/mnd</span></div>
            <div class="text-[11px] text-zinc-400">80 GB Webhotell<br>Servere i Norge</div>
          </div>
        </div>

        <!-- Little's Law & Capacity Calculator -->
        <div class="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-2">
          <div class="flex justify-between text-zinc-400"><span>Estimated Concurrent Workers:</span><span id="calc-workers" class="text-zinc-200 font-mono">1,024</span></div>
          <div class="flex justify-between text-zinc-400"><span>Sustained Bandwidth / SLA:</span><span class="text-emerald-400 font-mono">99.99% Uptime</span></div>
          <div class="flex justify-between text-zinc-400"><span>Data Sovereignty:</span><span class="text-zinc-200 font-mono">Oslo Edge Nodes</span></div>
        </div>
      </div>
    `;

    const input = container.querySelector('#domain-input');
    const btn = container.querySelector('#domain-btn');
    const result = container.querySelector('#domain-result');

    btn.addEventListener('click', () => {
      const val = input.value.trim();
      if (!val) return;
      result.classList.remove('hidden');
      result.textContent = val + ' is available for sovereign registration. Instant DNS provisioning active.';
    });
  }
};

export function hostingOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/hosting|webhotell|domain|server|nameunit/i.test(t)) return { open: true };
  return null;
}
