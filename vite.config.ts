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
			// %sveltekit.nonce%. No third-party scripts or fonts; map tiles are the only external images.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					// Svelte `style:` directives use inline styles.
					'style-src': ['self', 'unsafe-inline'],
					// Map tiles for the interactive maps (#29): Esri imagery and OpenStreetMap.
					'img-src': [
						'self',
						'data:',
						'https://server.arcgisonline.com',
						'https://tile.openstreetmap.org'
					],
					'font-src': ['self', 'data:'],
					'connect-src': ['self'],
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
