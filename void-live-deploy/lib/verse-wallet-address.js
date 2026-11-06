// Verse's receiving address on Base, kept in the repo so it ships with the site. It is a public address, not a secret: anyone who
// pays Verse sees it. Fill it with the address of a self-custody wallet Atom made for Verse (any EVM wallet; no exchange deposit
// address, since an exchange may not credit USDC on Base). Empty = not set. Atom's words, 2026-11-06: "the point is for it to find
// the money not me". VERSE_WALLET_ADDR on the Pages project still wins over this line when set (lib/verse-wallet.js walletOf).
export const VERSE_WALLET = '';
