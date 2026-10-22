/**
 * Tower of real sites (owner 2026-10-22): 100+ sites in categories Verse can one-up or study.
 * The lap finds more sites and categories each cycle. Pure data + helpers; no network.
 * Fashion / clothes / merch added at owner request.
 */
export const CATEGORIES = [
  { id: 'search-ai', label: 'Search and AI', sites: [
    { name: 'Google', url: 'https://google.com' },
    { name: 'Perplexity', url: 'https://perplexity.ai' },
    { name: 'ChatGPT', url: 'https://chatgpt.com' },
    { name: 'Claude', url: 'https://claude.ai' },
    { name: 'Bing', url: 'https://bing.com' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com' },
  ]},
  { id: 'email-calendar', label: 'Email and calendar', sites: [
    { name: 'Gmail', url: 'https://mail.google.com' },
    { name: 'Outlook', url: 'https://outlook.live.com' },
    { name: 'Calendly', url: 'https://calendly.com' },
    { name: 'Google Calendar', url: 'https://calendar.google.com' },
  ]},
  { id: 'work', label: 'Work', sites: [
    { name: 'Google Docs', url: 'https://docs.google.com' },
    { name: 'Airtable', url: 'https://airtable.com' },
    { name: 'Asana', url: 'https://asana.com' },
    { name: 'Jira', url: 'https://www.atlassian.com/software/jira' },
    { name: 'Figma', url: 'https://figma.com' },
    { name: 'Canva', url: 'https://canva.com' },
    { name: 'Notion', url: 'https://notion.so' },
    { name: 'Slack', url: 'https://slack.com' },
    { name: 'Linear', url: 'https://linear.app' },
  ]},
  { id: 'media', label: 'Media', sites: [
    { name: 'YouTube', url: 'https://youtube.com' },
    { name: 'TikTok', url: 'https://tiktok.com' },
    { name: 'Spotify', url: 'https://spotify.com' },
    { name: 'Substack', url: 'https://substack.com' },
    { name: 'Twitch', url: 'https://twitch.tv' },
    { name: 'Netflix', url: 'https://netflix.com' },
    { name: 'Vimeo', url: 'https://vimeo.com' },
  ]},
  { id: 'learning', label: 'Learning', sites: [
    { name: 'Wikipedia', url: 'https://wikipedia.org' },
    { name: 'Duolingo', url: 'https://duolingo.com' },
    { name: 'Khan Academy', url: 'https://khanacademy.org' },
    { name: 'Coursera', url: 'https://coursera.org' },
    { name: 'Codecademy', url: 'https://codecademy.com' },
  ]},
  { id: 'social-dating', label: 'Social and dating', sites: [
    { name: 'Reddit', url: 'https://reddit.com' },
    { name: 'Discord', url: 'https://discord.com' },
    { name: 'Pinterest', url: 'https://pinterest.com' },
    { name: 'Hinge', url: 'https://hinge.co' },
    { name: 'X', url: 'https://x.com' },
    { name: 'Instagram', url: 'https://instagram.com' },
    { name: 'LinkedIn', url: 'https://linkedin.com' },
  ]},
  { id: 'getting-around', label: 'Getting around', sites: [
    { name: 'Google Maps', url: 'https://maps.google.com' },
    { name: 'Airbnb', url: 'https://airbnb.com' },
    { name: 'Uber', url: 'https://uber.com' },
    { name: 'Waymo', url: 'https://waymo.com' },
    { name: 'Lyft', url: 'https://lyft.com' },
  ]},
  { id: 'food-shopping', label: 'Food and shopping', sites: [
    { name: 'DoorDash', url: 'https://doordash.com' },
    { name: 'Instacart', url: 'https://instacart.com' },
    { name: 'Yelp', url: 'https://yelp.com' },
    { name: 'Amazon', url: 'https://amazon.com' },
    { name: 'Etsy', url: 'https://etsy.com' },
    { name: 'Walmart', url: 'https://walmart.com' },
  ]},
  { id: 'creator-stores', label: 'Creator stores', sites: [
    { name: 'Gumroad', url: 'https://gumroad.com' },
    { name: 'Patreon', url: 'https://patreon.com' },
    { name: 'Ko-fi', url: 'https://ko-fi.com' },
  ]},
  { id: 'money', label: 'Money', sites: [
    { name: 'PayPal', url: 'https://paypal.com' },
    { name: 'Venmo', url: 'https://venmo.com' },
    { name: 'Coinbase', url: 'https://coinbase.com' },
    { name: 'TurboTax', url: 'https://turbotax.intuit.com' },
    { name: 'Stripe', url: 'https://stripe.com' },
    { name: 'Robinhood', url: 'https://robinhood.com' },
  ]},
  { id: 'jobs-homes', label: 'Jobs and homes', sites: [
    { name: 'Indeed', url: 'https://indeed.com' },
    { name: 'Upwork', url: 'https://upwork.com' },
    { name: 'Zillow', url: 'https://zillow.com' },
    { name: 'Glassdoor', url: 'https://glassdoor.com' },
    { name: 'Realtor', url: 'https://realtor.com' },
  ]},
  { id: 'health', label: 'Health', sites: [
    { name: 'WebMD', url: 'https://webmd.com' },
    { name: 'MyFitnessPal', url: 'https://myfitnesspal.com' },
    { name: 'Strava', url: 'https://strava.com' },
    { name: 'Mayo Clinic', url: 'https://mayoclinic.org' },
  ]},
  { id: 'government', label: 'Government', sites: [
    { name: 'IRS.gov', url: 'https://irs.gov' },
    { name: 'Healthcare.gov', url: 'https://healthcare.gov' },
    { name: 'USA.gov', url: 'https://usa.gov' },
  ]},
  { id: 'everyday-tools', label: 'Everyday tools', sites: [
    { name: 'Dropbox', url: 'https://dropbox.com' },
    { name: 'DeepL', url: 'https://deepl.com' },
    { name: 'Google Drive', url: 'https://drive.google.com' },
    { name: '1Password', url: 'https://1password.com' },
  ]},
  { id: 'games', label: 'Games', sites: [
    { name: 'Chess.com', url: 'https://chess.com' },
    { name: 'Steam', url: 'https://store.steampowered.com' },
    { name: 'Roblox', url: 'https://roblox.com' },
    { name: 'NYT Games', url: 'https://www.nytimes.com/crosswords' },
    { name: 'itch.io', url: 'https://itch.io' },
  ]},
  // owner request 2026-10-22: clothes, fashion, merch
  { id: 'fashion-merch', label: 'Clothes, fashion and merch', sites: [
    { name: 'Nike', url: 'https://nike.com' },
    { name: 'Zara', url: 'https://zara.com' },
    { name: 'Uniqlo', url: 'https://uniqlo.com' },
    { name: 'H&M', url: 'https://hm.com' },
    { name: 'ASOS', url: 'https://asos.com' },
    { name: 'Depop', url: 'https://depop.com' },
    { name: 'StockX', url: 'https://stockx.com' },
    { name: 'GOAT', url: 'https://goat.com' },
    { name: 'Shein', url: 'https://shein.com' },
    { name: 'Lululemon', url: 'https://lululemon.com' },
    { name: 'Patagonia', url: 'https://patagonia.com' },
    { name: 'Teespring / Spring', url: 'https://www.spri.ng' },
    { name: 'Printful', url: 'https://printful.com' },
    { name: 'Redbubble', url: 'https://redbubble.com' },
  ]},
  { id: 'dev', label: 'Developer tools', sites: [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
    { name: 'Vercel', url: 'https://vercel.com' },
    { name: 'Cloudflare', url: 'https://cloudflare.com' },
    { name: 'npm', url: 'https://npmjs.com' },
  ]},
  { id: 'news', label: 'News', sites: [
    { name: 'BBC', url: 'https://bbc.com' },
    { name: 'Reuters', url: 'https://reuters.com' },
    { name: 'TechCrunch', url: 'https://techcrunch.com' },
    { name: 'The Verge', url: 'https://theverge.com' },
  ]},
];

export const allSites = () => CATEGORIES.flatMap((c) => c.sites.map((s) => ({ ...s, category: c.id, categoryLabel: c.label })));
export const counts = () => ({ categories: CATEGORIES.length, sites: allSites().length });
export function byCategory(id) {
  return CATEGORIES.find((c) => c.id === id || c.label.toLowerCase() === String(id || '').toLowerCase()) || null;
}
export function findSite(q) {
  const n = String(q || '').toLowerCase().trim();
  if (!n) return null;
  return allSites().find((s) => s.name.toLowerCase() === n || s.name.toLowerCase().includes(n)) || null;
}
