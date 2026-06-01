/**
 * Redmont Essentials — Site Configuration
 * Update these values with your real Discord and business info.
 */
const SITE_CONFIG = {
  discordInviteUrl: 'https://discord.gg/YEK4K2cY7n',
  discordInviteCode: 'YEK4K2cY7n',

  // Optional: in-game shop location shown in future bot integration
  shopLocation: 'Redmont — ask on Discord for directions',

  // Order form API (Cloudflare Pages Function when deployed)
  orderApiUrl: '/api/order',
  catalogApiUrl: '/api/catalog',

  // Cloudflare Turnstile site key (public) — get from Cloudflare Dashboard → Turnstile
  // Leave empty to disable verification (not recommended for production)
  turnstileSiteKey: '0x4AAAAAADc0fsKxdtGc6Go3',

  inGameCompanyName: 'Redmont Essentials',
};
