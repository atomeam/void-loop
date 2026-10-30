// Deploy a-to-mind.com straight from this machine, with no GitHub in the path (owner, 2026-10-23: "no more github ... upgrade the site
// directly"). The same steps deploy.yml runs before its upload (regenerate the cards, the served ledger and quotes, the ledger proof),
// then wrangler pages deploy of void-live-deploy to the a-to-mind project, branch main. The commit is still pushed to main afterwards by
// whoever runs this, so the repo and the site never drift (verify.yml still reverts a commit that breaks the suite).
//   CLOUDFLARE_API_TOKEN=<token with Account > Cloudflare Pages > Edit> CLOUDFLARE_ACCOUNT_ID=<id> node tools/deploy-direct.mjs
//   --dry-run   run every step except the upload
// Needs the hosts api.cloudflare.com (and a-to-mind.com for the smoke check) reachable from this machine.
import { execFileSync } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dry = process.argv.includes('--dry-run');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'].filter((k) => !process.env[k]);
if (missing.length && !dry) { console.error('deploy-direct: ' + missing.join(' and ') + ' not set in this environment (add them as environment variables; never in a file)'); process.exit(2); }
for (const t of [['refresh.mjs', '--keep-going'], ['public-ledger.mjs'], ['public-quotes.mjs'], ['ledger-proof.mjs', '--out', 'void-live-deploy']]) {
  try { run(process.execPath, [path.join('tools', t[0]), ...t.slice(1)]); } catch (e) { console.error('deploy-direct: ' + t[0] + ' failed; not deploying'); process.exit(1); }
}
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
const args = ['--yes', 'wrangler@3.114.17', 'pages', 'deploy', '.', '--project-name=a-to-mind', '--branch=main', '--commit-hash=' + sha, '--commit-dirty=true'];
if (dry) { console.log('deploy-direct (dry run): would run npx ' + args.join(' ') + ' in void-live-deploy'); process.exit(0); }
run('npx', args, { cwd: path.join(root, 'void-live-deploy') });
console.log('deploy-direct: uploaded ' + sha.slice(0, 7) + ' to a-to-mind (main). Push the same commit to main so the repo matches the site.');
