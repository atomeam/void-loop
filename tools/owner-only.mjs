// node tools/owner-only.mjs /path  -> exit 0 when that path answers only the owner (void-live-deploy/lib/owner-gate.js), else 1.
// deploy.yml's live check asks it before fetching a file, so a file that became owner-only never fails a good deploy.
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';
process.exit(process.argv[2] && ownerOnlyPath(process.argv[2]) ? 0 : 1);
