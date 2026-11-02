import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ out: 'build' }),
			// Per-request nonces for SSR pages; the pre-paint theme script in app.html carries
			// %sveltekit.nonce%. No third-party scripts, fonts or tiles: everything is bundled.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					// Svelte `style:` directives use inline styles.
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:'],
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
