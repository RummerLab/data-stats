import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'#lib': path.join(root, 'src/lib'),
			'#lib/': path.join(root, 'src/lib/')
		}
	},
	test: {
		name: 'data-stats',
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		// Tests never touch the real spreadsheets: the importer suite reads samples/fixture.
		env: { DATA_DIR: path.join(root, 'samples/fixture'), DATABASE_PATH: ':memory:' },
		testTimeout: 60_000,
		reporters: ['default']
	}
});
