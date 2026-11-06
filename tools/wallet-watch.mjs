#!/usr/bin/env node
// wallet-watch: what Verse's wallet has actually received, read from the chain (Base mainnet, USDC), on the daily treasury run
// (.github/workflows/treasury.yml). Every USDC transfer into the wallet is listed with its transaction, sender and amount: an x402 call,
// a bounty or grant paid out to the address, anyone's payment. Nothing here is a forecast and nothing is claimed: a row exists only
// because the chain shows the transfer. Read only: no key, no signing, nothing sent.
//   node tools/wallet-watch.mjs          read the chain and write void-live-deploy/treasury/wallet.json
//   node tools/wallet-watch.mjs --dry    print what it read; nothing written
// The worker's own live balance read (lib/verse-wallet.js usdcBalance) can get no answer from the public RPC; this file is the record
// the treasury page falls back on, with the time it was read.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'void-live-deploy/treasury/wallet.json');
export const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // keccak256("Transfer(address,address,uint256)")
const DAY_BLOCKS = 43200; // Base makes a block every 2 seconds
const KEEP = 200; // the newest transfers kept in the file; the total counts every one ever read

const topicOf = (addr) => '0x' + String(addr).slice(2).toLowerCase().padStart(64, '0');
const addrOf = (topic) => '0x' + String(topic).slice(-40);

/** The wallet address in lib/verse-wallet-address.js (the repo's own record). Pure over the file text. */
export function walletFromSource(text) {
  const m = /VERSE_WALLET\s*=\s*'(0x[0-9a-fA-F]{40})'/.exec(String(text || ''));
  return m ? m[1] : null;
}

/** eth_getLogs results -> incoming transfers, newest first, one per log. Pure. */
export function incoming(logs, address) {
  const to = topicOf(address);
  return (logs || []).filter((l) => l && String(l.address).toLowerCase() === USDC_BASE && Array.isArray(l.topics) && l.topics[0] === TRANSFER && String(l.topics[2]).toLowerCase() === to && !l.removed)
    .map((l) => ({ tx: String(l.transactionHash).toLowerCase(), log: parseInt(l.logIndex, 16), block: parseInt(l.blockNumber, 16), from: addrOf(l.topics[1]), units: BigInt(l.data).toString() }))
    .sort((a, b) => b.block - a.block || b.log - a.log);
}

/** The previous record and this read merged: no transfer twice, totals over every transfer ever read. Pure. */
export function merge(prev, rows, { address, toBlock, balanceUnits, now }) {
  const seen = new Set(), all = [];
  for (const r of [...rows, ...((prev && prev.address && prev.address.toLowerCase() === address.toLowerCase() && prev.incoming) || [])]) {
    const k = r.tx + ':' + r.log; if (seen.has(k)) continue; seen.add(k); all.push(r);
  }
  all.sort((a, b) => b.block - a.block || b.log - a.log);
  const same = prev && prev.address && prev.address.toLowerCase() === address.toLowerCase();
  const before = same ? BigInt(prev.received_units || '0') - (prev.incoming || []).reduce((n, r) => n + BigInt(r.units), 0n) : 0n; // dropped from the list, still counted
  const received = before + all.reduce((n, r) => n + BigInt(r.units), 0n);
  return { as_of: now, address, network: 'Base', asset: 'USDC', contract: USDC_BASE, read_to_block: toBlock,
    balance_units: balanceUnits, balance_cents: balanceUnits == null ? null : Number(BigInt(balanceUnits) / 10000n),
    transfers_in: (same ? (prev.transfers_in || 0) - (prev.incoming || []).length : 0) + all.length, received_units: received.toString(), received_cents: Number(received / 10000n),
    rule: 'Every row is a USDC transfer into the wallet that the chain shows (eth_getLogs on Base). Nothing is estimated, and nothing here was claimed or signed.',
    incoming: all.slice(0, KEEP) };
}

async function rpc(url, method, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (j.error || j.result == null) throw new Error(method + ': ' + ((j.error && j.error.message) || r.status));
  return j.result;
}

/** Read the chain from where the last read stopped (or the last 2 days) to now, in chunks a public RPC accepts. */
export async function read({ url = process.env.BASE_RPC_URL || 'https://mainnet.base.org', address, prev, now = new Date().toISOString(), chunk = 2000 } = {}) {
  const latest = parseInt(await rpc(url, 'eth_blockNumber', []), 16);
  const same = prev && prev.address && prev.address.toLowerCase() === address.toLowerCase() && prev.read_to_block;
  let from = same ? prev.read_to_block + 1 : Math.max(0, latest - 2 * DAY_BLOCKS);
  if (latest - from > 7 * DAY_BLOCKS) from = latest - 7 * DAY_BLOCKS; // a long gap: the last week, and the gap is said in the file
  const logs = [];
  for (let a = from; a <= latest;) {
    const b = Math.min(latest, a + chunk - 1);
    try { logs.push(...await rpc(url, 'eth_getLogs', [{ address: USDC_BASE, topics: [TRANSFER, null, topicOf(address)], fromBlock: '0x' + a.toString(16), toBlock: '0x' + b.toString(16) }])); a = b + 1; }
    catch (e) { if (chunk <= 125) throw e; chunk = Math.floor(chunk / 2); } // the RPC wants a smaller range
  }
  const bal = BigInt(await rpc(url, 'eth_call', [{ to: USDC_BASE, data: '0x70a08231' + topicOf(address).slice(2) }, 'latest'])).toString();
  const out = merge(prev, incoming(logs, address), { address, toBlock: latest, balanceUnits: bal, now });
  if (same && from !== prev.read_to_block + 1) out.gap = 'blocks ' + (prev.read_to_block + 1) + ' to ' + (from - 1) + ' were not read (more than a week since the last read)';
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const address = walletFromSource(readFileSync(resolve(root, 'void-live-deploy/lib/verse-wallet-address.js'), 'utf8'));
  if (!address) { console.log('wallet watch: no wallet address in lib/verse-wallet-address.js; nothing to read'); process.exit(0); }
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  let r;
  try { r = await read({ address, prev }); }
  catch (e) { console.log('wallet watch: the chain gave no answer (' + e.message + '); the last record stays as it is'); process.exit(0); }
  console.log(`wallet watch: ${address} holds ${r.balance_units} USDC units; ${r.transfers_in} transfer(s) in, ${r.received_units} units received in all; read to block ${r.read_to_block}`);
  if (process.argv.includes('--dry')) { for (const t of r.incoming.slice(0, 20)) console.log('-', t.block, t.tx, 'from', t.from, t.units); process.exit(0); }
  writeFileSync(OUT, JSON.stringify(r, null, 1) + '\n');
}
