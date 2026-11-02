/**
 * Renders the social preview images (#30) with Playwright's Chromium:
 *   static/og-image.png        1200×630  og:image / twitter:image for data.physioshark.org
 *   docs/social-preview.png    1280×640  GitHub repository social preview (upload by hand)
 *
 * The wave is a stylised two-tide day, not data, so the images never go stale.
 * Run: pnpm social-preview
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const b64 = (p) => readFileSync(resolve(root, p)).toString('base64');
const font = b64('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
const logo = b64('static/logo-physioshark.png');

/** Sea level over a day at Mo'orea: two highs (noon, midnight), small and regular. */
function wave(width, height, base, amp) {
	const pts = [];
	for (let x = 0; x <= width; x += 8) {
		const t = (x / width) * 2 * Math.PI * 1.5;
		pts.push(`${x},${(base - amp * Math.cos(2 * t) - amp * 0.25 * Math.cos(t + 0.6)).toFixed(1)}`);
	}
	return `M0,${height} L${pts.join(' L')} L${width},${height} Z`;
}

function html(w, h) {
	return `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: ${w}px; height: ${h}px; overflow: hidden; font-family: Inter, sans-serif; color: #f2f6fb;
  background: radial-gradient(120% 90% at 85% 0%, #1b4a80 0%, #102a4c 45%, #0b1a30 100%); position: relative; }
.pad { position: absolute; inset: 0; padding: ${Math.round(h * 0.11)}px ${Math.round(w * 0.075)}px; display: flex; flex-direction: column; }
.top { display: flex; align-items: center; gap: 18px; }
.logo { height: ${Math.round(h * 0.11)}px; filter: brightness(0) invert(0.96); }
.chip { font-weight: 700; font-size: ${Math.round(h * 0.034)}px; letter-spacing: .08em; text-transform: uppercase;
  background: #1d5fb8; color: #fff; padding: 4px 12px; border-radius: 8px; }
.eyebrow { margin-top: auto; font-size: ${Math.round(h * 0.032)}px; font-weight: 600; letter-spacing: .14em;
  text-transform: uppercase; color: #8cc4ea; }
h1 { margin-top: 14px; font-size: ${Math.round(h * 0.105)}px; line-height: 1.02; font-weight: 800;
  text-transform: uppercase; letter-spacing: -.01em; max-width: 92%; }
.sub { margin-top: 18px; font-size: ${Math.round(h * 0.036)}px; color: #b9c7da; max-width: 95%; }
.url { margin-top: ${Math.round(h * 0.05)}px; font-size: ${Math.round(h * 0.034)}px; font-weight: 600; color: #f2f6fb; }
svg { position: absolute; left: 0; right: 0; bottom: 0; }
</style></head><body>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="${wave(w, h, h * 0.83, h * 0.035)}" fill="#2a78d6" opacity=".16"/>
  <path d="${wave(w, h, h * 0.89, h * 0.028)}" fill="#3987e5" opacity=".14"/>
</svg>
<div class="pad">
  <div class="top"><img class="logo" src="data:image/png;base64,${logo}" alt=""><span class="chip">Data</span></div>
  <p class="eyebrow">Mo'orea, French Polynesia</p>
  <h1>Thirteen seasons of baby sharks, in numbers</h1>
  <p class="sub">Shark-nursery surveys joined with weather, ocean, tide, climate and moon data.</p>
  <p class="url">data.physioshark.org</p>
</div>
</body></html>`;
}

const browser = await chromium.launch();
for (const [file, w, h] of [
	['static/og-image.png', 1200, 630],
	['docs/social-preview.png', 1280, 640]
]) {
	const page = await browser.newPage({ viewport: { width: w, height: h } });
	await page.setContent(html(w, h), { waitUntil: 'load' });
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: resolve(root, file) });
	await page.close();
	console.log(`wrote ${file}`);
}
await browser.close();
