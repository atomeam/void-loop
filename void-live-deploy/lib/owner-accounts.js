// The owner's Verse accounts, by account id (owner, 2026-10-30: "bind that stage account as the owner directly ... so my existing
// sign-in works on reload"). An id goes here only from the owner's own message, read off their own signed-in device (/team/ shows it
// when an account is signed in but not the owner's). An account id alone opens nothing: only a live session of that account counts
// (lib/guard.js ownerAccountSession). The owner key and the owner passkeys keep working beside this list.
export const OWNER_ACCOUNTS = Object.freeze([
  'hX_IyucPwcd-h6NM3FyPvw', // the owner's stage account, from their own message 2026-10-30 04:38 UTC (read off /team/ on their device)
]);
export const ACCOUNT_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
