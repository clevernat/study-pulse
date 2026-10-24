// Renders the app icons (PNG) from the pulse logo. Run: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";

const pulse = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${64 + 2 * pad} ${64 + 2 * pad}" width="100%" height="100%">
  <defs><linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#1a1028"/><stop offset="100%" stop-color="#0e0e14"/></linearGradient></defs>
  <rect x="${-pad}" y="${-pad}" width="${64 + 2 * pad}" height="${64 + 2 * pad}" fill="url(#g)"/>
  <polyline points="8,36 18,36 22,22 28,46 34,28 40,40 46,36 56,36" stroke="#d2bbff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

// Plain icons: small padding. Maskable: content inside the 80% safe zone.
const icons = [
  ["icon-192.png", 192, 4], ["icon-512.png", 512, 4],
  ["maskable-512.png", 512, 12], ["apple-touch-icon.png", 180, 6],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${pulse(pad)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false });
  console.log("wrote", name);
}
await browser.close();
