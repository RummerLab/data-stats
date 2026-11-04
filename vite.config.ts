import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Release version shown in the footer. Release workflows bump package.json before tagging.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version)
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ out: 'build' }),
			// Per-request nonces for SSR pages; the pre-paint theme script in app.html carries
			// %sveltekit.nonce%. Third-party: GA4 (gtag) and map tiles (images only).
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self', 'https://www.googletagmanager.com'],
					// Svelte `style:` directives use inline styles.
					'style-src': ['self', 'unsafe-inline'],
					// Map tiles for the interactive maps (#29): Esri imagery and OpenStreetMap.
					// GA4 beacons may use image pings.
					'img-src': [
						'self',
						'data:',
						'https://server.arcgisonline.com',
						'https://tile.openstreetmap.org',
						'https://www.google-analytics.com',
						'https://www.googletagmanager.com'
					],
					'font-src': ['self', 'data:'],
					'connect-src': [
						'self',
						'https://*.google-analytics.com',
						'https://*.analytics.google.com',
						'https://*.googletagmanager.com'
					],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	],
	ssr: {
		external: ['better-sqlite3']
	},
	optimizeDeps: {
		exclude: ['better-sqlite3']
	}
});
