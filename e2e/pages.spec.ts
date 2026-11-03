import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { NAV } from '../src/lib/nav';

const ROUTES = [
	...NAV.flatMap((g) => g.items.map((i) => i.href)),
	'/seasons/2021-2022',
	'/nurseries/haapiti'
];

// Map tiles come from third-party hosts: serve a blank tile so tests don't depend on them.
const BLANK_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);
test.beforeEach(async ({ page }) => {
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) =>
		route.fulfill({ contentType: 'image/png', body: BLANK_PNG })
	);
});

async function axe(page: Page) {
	const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
	return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

for (const route of ROUTES) {
	test(`renders ${route}`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		const res = await page.goto(route);
		expect(res?.status()).toBe(200);
		await expect(page.locator('h1').first()).toBeVisible();
		expect(errors).toEqual([]);
	});
}

for (const theme of ['light', 'dark'] as const) {
	test(`axe: no serious violations (${theme})`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
		const failures: string[] = [];
		for (const route of [
			'/',
			'/nurseries',
			'/drivers',
			'/tides',
			'/sharks',
			'/findings',
			'/crew',
			'/about'
		]) {
			await page.goto(route);
			for (const v of await axe(page))
				failures.push(`${route}: ${v.id} (${v.nodes.length}) ${v.help}`);
		}
		expect(failures).toEqual([]);
	});
}

test('nursery links open a profile and the menu works on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByText('Biology').click();
	await page.getByRole('link', { name: /Growth/ }).click();
	await expect(page.locator('h1')).toHaveText('Growth');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(1);
});
