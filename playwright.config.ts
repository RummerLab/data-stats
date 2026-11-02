import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the production build (`pnpm build` first), importing the SYNTHETIC workbooks in
 * samples/fixture into a throwaway database. Real spreadsheets never reach CI.
 */
export const PORT = 4310;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	timeout: 60_000,
	use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
	webServer: {
		command: 'node scripts/server.mjs',
		port: PORT,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			PORT: String(PORT),
			HOST: '127.0.0.1',
			DATA_DIR: 'samples/fixture',
			DATABASE_PATH: 'e2e/.tmp/e2e.sqlite',
			EXTERNAL_DIR: 'external'
		}
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
