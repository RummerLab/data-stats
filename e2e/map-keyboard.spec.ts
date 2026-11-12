import { expect, test } from '@playwright/test';

test('move lines expose their details to the keyboard after overlay toggles', async ({ page }) => {
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) => route.abort());
	await page.goto('/recaptures');
	const map = page.getByRole('region', {
		name: "Map of recaptured sharks' moves between nurseries"
	});
	const line = map.locator('.ps-line-0[role="button"]').first();
	await expect(line).toBeVisible();
	const label = await line.getAttribute('aria-label');
	await line.focus();
	await expect(map.locator('.leaflet-tooltip').last()).toHaveText(label!);
	await line.press('Enter');
	await expect(map.locator('.leaflet-popup-content')).toContainText(label!);
	await line.press('Escape');
	await expect(map.locator('.leaflet-popup-content')).toHaveCount(0);
	// Re-adding an overlay creates another path element: it must retain the handlers.
	const toggle = map.getByRole('checkbox', { name: /Blacktip.*moves/i });
	await toggle.uncheck();
	await toggle.check();
	await line.focus();
	await line.press('Space');
	await expect(map.locator('.leaflet-popup-content')).toContainText(label!);
});

test('SVG map fallback supports the shared arrow-key chart controls', async ({ page }) => {
	// Keep the hydrated SVG fallback by preventing the lazy Leaflet module from loading.
	await page.route('**/*.js', async (route) => {
		const response = await route.fetch();
		const body = await response.text();
		if (body.includes('Leaflet') && body.includes('1.9.4')) await route.abort();
		else await route.fulfill({ response, body });
	});
	await page.goto('/recaptures');
	const map = page.locator('.chart-card').filter({
		has: page.getByRole('heading', { name: 'Moves between nurseries on the map', exact: true })
	});
	const svg = map.locator('svg[role="application"]');
	await expect(svg).toBeVisible();
	await svg.focus();
	await svg.press('Home');
	await expect(map.locator('.tip')).toContainText('Moves');
	await svg.press('End');
	await expect(map.locator('.tip')).toContainText('Same-nursery recaptures');
	await svg.press('Escape');
	await expect(map.locator('.tip')).toHaveCount(0);
});

test('directed move markers and keyboard controls survive a zoom redraw', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) => route.abort());
	await page.goto('/recaptures');
	const map = page.getByRole('region', {
		name: "Map of recaptured sharks' moves between nurseries"
	});
	const line = map.locator('.ps-line-0[role="button"]').first();
	await expect(line).toBeVisible();
	const before = await line.getAttribute('d');
	// marker-mid needs an interior vertex, not just the two endpoints.
	expect(before!.match(/[ML]/g)!.length).toBeGreaterThanOrEqual(3);
	await map.getByRole('button', { name: 'Zoom in', exact: true }).click();
	await expect.poll(() => line.getAttribute('d')).not.toBe(before);
	for (const path of await map.locator('.ps-line').all()) {
		const ref = await path.getAttribute('marker-mid');
		expect(ref).toMatch(/^url\(#.+\)$/);
		const id = ref!.slice(5, -1);
		expect(await page.evaluate((id) => document.getElementById(id)?.tagName, id)).toBe('marker');
	}
	await line.focus();
	await line.press('Enter');
	await expect(map.locator('.leaflet-popup-content')).toContainText(
		(await line.getAttribute('aria-label'))!
	);
});

test('nursery circles are keyboard reachable, support popup links and survive season redraws (#185)', async ({
	page
}) => {
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) => route.abort());
	await page.goto('/nurseries');
	const map = page.getByRole('region', {
		name: "Map of Mo'orea's shark nurseries"
	});
	const circle = map.locator('.ps-layer[role="button"]').first();
	await expect(circle).toBeVisible();
	const label = await circle.getAttribute('aria-label');
	expect(label).toBeTruthy();
	// Focus visibly identifies the selected circle and opens the tooltip
	await circle.focus();
	await expect(map.locator('.leaflet-tooltip').last()).toBeVisible();
	// Press Enter to open details popup; focus moves to the reachable link
	await circle.press('Enter');
	const popup = map.locator('.leaflet-popup-content');
	await expect(popup).toBeVisible();
	const link = popup.locator('a');
	await expect(link).toBeVisible();
	await expect(link).toBeFocused();
	// Escape dismisses details without trapping focus and restores focus to circle
	await page.keyboard.press('Escape');
	await expect(popup).toHaveCount(0);
	await expect(circle).toBeFocused();
	// Space key also activates
	await circle.press('Space');
	await expect(popup).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(popup).toHaveCount(0);
	await expect(circle).toBeFocused();
	// Controls survive season redraws
	const slider = page.getByRole('slider', { name: /season/i });
	if (await slider.isVisible()) {
		await slider.fill('0');
		const seasonCircle = map.locator('.ps-layer[role="button"]').first();
		await expect(seasonCircle).toBeVisible();
		await seasonCircle.focus();
		await seasonCircle.press('Enter');
		await expect(map.locator('.leaflet-popup-content')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(map.locator('.leaflet-popup-content')).toHaveCount(0);
		await expect(seasonCircle).toBeFocused();
	}
});

test('adult capture circles are keyboard reachable and survive zoom and overlay toggles (#185)', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) => route.abort());
	// Inject synthetic adult points so the density map renders with circle markers
	await page.route('**/adults/__data.json*', async (route) => {
		const response = await route.fetch();
		const body = await response.json();
		const node = body.nodes.find(
			(n: { data?: unknown[] } | null) => n?.data?.[0] && 'where' in (n.data[0] as object)
		);
		if (!node) {
			await route.fulfill({ response, json: body });
			return;
		}
		const data: unknown[] = node.data;
		const root = data[0] as Record<string, number>;
		const where = data[root.where] as Record<string, number>;
		const add = (v: unknown) => data.push(v) - 1;
		root.n = add(1);
		const point = add({
			id: add('adult-0'),
			label: add('Adult blacktip “Synthetic”'),
			lat: add(-17.5),
			lon: add(-149.85),
			sub: add('2022-01-01 · Haapiti')
		});
		where.points = add([point]);
		const cell = add({
			south: add(-17.51),
			west: add(-149.86),
			north: add(-17.5),
			east: add(-149.85),
			bin: add(1)
		});
		where.density = add({
			n: add(20),
			bandwidthKm: add(0.3),
			cells: add([cell])
		});
		where.missing = add(0);
		where.setAside = add([]);
		await route.fulfill({ response, json: body });
	});
	await page.goto('/');
	await page
		.locator('a[href="/adults"]')
		.first()
		.evaluate((a: HTMLAnchorElement) => a.click());
	const map = page.getByRole('region', {
		name: 'Map of adult blacktip capture density'
	});
	await expect(map).toBeVisible();
	const circle = map.locator('.ps-layer[role="button"]').first();
	await expect(circle).toBeVisible();
	const label = await circle.getAttribute('aria-label');
	expect(label).toContain('Adult blacktip');
	await circle.focus();
	await expect(map.locator('.leaflet-tooltip').last()).toBeVisible();
	await circle.press('Enter');
	await expect(map.locator('.leaflet-popup-content')).toContainText('Adult blacktip “Synthetic”');
	await page.keyboard.press('Escape');
	await expect(map.locator('.leaflet-popup-content')).toHaveCount(0);
	await expect(circle).toBeFocused();
	// Controls survive zoom redraws
	await map.getByRole('button', { name: 'Zoom in', exact: true }).click();
	await page.waitForTimeout(200);
	await circle.focus();
	await circle.press('Space');
	await expect(map.locator('.leaflet-popup-content')).toContainText('Adult blacktip “Synthetic”');
	await page.keyboard.press('Escape');
	await expect(map.locator('.leaflet-popup-content')).toHaveCount(0);
	await expect(circle).toBeFocused();
	// Controls survive overlay toggles
	const toggle = map.getByRole('checkbox', { name: /Adult captures/i });
	await expect(toggle).toBeVisible();
	await toggle.uncheck();
	await expect(circle).not.toBeVisible();
	await toggle.check();
	await expect(circle).toBeVisible();
	await circle.focus();
	await circle.press('Enter');
	await expect(map.locator('.leaflet-popup-content')).toContainText('Adult blacktip “Synthetic”');
	await page.keyboard.press('Escape');
	await expect(map.locator('.leaflet-popup-content')).toHaveCount(0);
	await expect(circle).toBeFocused();
});
