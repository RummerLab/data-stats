import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) => route.abort());
});

test('recaptures map renders routed water lines with water and direct km (#183)', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/recaptures');

	const map = page.getByRole('region', {
		name: "Map of recaptured sharks' moves between nurseries"
	});
	await expect(map).toBeVisible();

	// Line follows multi-point routed path around the island
	const line = map.locator('.ps-line-0[role="button"]').first();
	await expect(line).toBeVisible();
	const d = await line.getAttribute('d');
	expect(d).not.toBeNull();
	// Multi-segment water route has multiple M/L coordinates
	expect(d!.match(/[ML]/g)!.length).toBeGreaterThanOrEqual(4);

	// Line tooltip or popup reflects water km
	await line.focus();
	await line.press('Enter');
	const popup = map.locator('.leaflet-popup-content');
	await expect(popup).toBeVisible();
	await expect(popup).toContainText('km by water');

	// Note credits OpenStreetMap coastline data
	await expect(page.getByText('OpenStreetMap coastline data')).toBeVisible();

	// Longest moves table displays both water km and direct km
	const table = page.locator('table').first();
	await expect(table.getByRole('columnheader', { name: 'km (water)' })).toBeVisible();
	await expect(table.getByRole('columnheader', { name: 'km (direct)' })).toBeVisible();
});

test('shark detail page plays moves along the water route with distance (#183)', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/recaptures');

	// Navigate to the first shark with a move from the table
	const sharkLink = page.locator('table a[href^="/sharks/"]').first();
	await expect(sharkLink).toBeVisible();
	await sharkLink.click();

	await expect(page.locator('h1')).toBeVisible();

	// Subtitle explains water route estimate
	await expect(page.getByText('along the shortest water route')).toBeVisible();

	// Play button and slider exist
	const slider = page.locator('#capture-slider');
	if ((await slider.count()) > 0) {
		// Advance slider to step 1 (second capture)
		await slider.fill('1');
		const output = page.locator('output[for="capture-slider"]');
		await expect(output).toContainText('km by water');

		// Traveller dot exists on map
		const traveller = page.locator('.ps-traveller');
		await expect(traveller).toBeVisible();
	}
});

test('shark detail page animates move line and traveller dot along water route (#183)', async ({
	page
}) => {
	await page.goto('/recaptures');

	const sharkLink = page.locator('table a[href^="/sharks/"]').first();
	await expect(sharkLink).toBeVisible();
	await sharkLink.click();

	await expect(page.locator('h1')).toBeVisible();

	const playBtn = page.locator('button.play');
	const slider = page.locator('#capture-slider');
	if ((await slider.count()) > 0) {
		// Defaults to "All moves" overview on page load with arrows visible (#183)
		const allMovesBtn = page.locator('button.stop-btn', { hasText: 'All moves' });
		await expect(allMovesBtn).toHaveClass(/active/);
		await expect(playBtn).toHaveText('Play');

		const arrows = await page.locator('.ps-arrow').all();
		expect(arrows.length).toBeGreaterThan(0);
		for (const arrow of arrows) {
			const opacity = await arrow.evaluate((el) => (el as SVGElement).style.opacity);
			expect(opacity).not.toBe('0');
		}

		// Start playback
		await playBtn.click();
		await expect(allMovesBtn).not.toHaveClass(/active/);

		// Arrow is removed when playback starts (#183)
		const activeArrow = page.locator('.ps-arrow').first();
		if ((await activeArrow.count()) > 0) {
			await expect
				.poll(async () => activeArrow.evaluate((el) => (el as SVGElement).style.opacity))
				.toBe('0');
		}

		// While stepping from capture 1 to capture 2, the line animates along the water route
		await expect(async () => {
			const animating = await page.evaluate(() => {
				const line = document.querySelector('.ps-line');
				return (
					line instanceof SVGElement &&
					line.style.strokeDasharray !== '' &&
					parseFloat(line.style.strokeDashoffset || '0') > 0
				);
			});
			expect(animating).toBe(true);
		}).toPass({ timeout: 4000 });

		// Traveller dot exists and glides along the water route
		const traveller = page.locator('.ps-traveller');
		await expect(traveller).toBeVisible();

		// Eventually animation finishes, stroke properties reset to normal, button shows Replay, and arrow remains removed
		await expect(async () => {
			const finished = await page.evaluate(() => {
				const line = document.querySelector('.ps-line');
				return line instanceof SVGElement && line.style.strokeDasharray === '';
			});
			expect(finished).toBe(true);
		}).toPass({ timeout: 5000 });

		await expect(playBtn).toHaveText('Replay');
		if ((await activeArrow.count()) > 0) {
			const finishedOpacity = await activeArrow.evaluate((el) => (el as SVGElement).style.opacity);
			expect(finishedOpacity).toBe('0');
		}

		// Clicking All moves restores all moves with their arrows
		await allMovesBtn.click();
		await expect(allMovesBtn).toHaveClass(/active/);
		await expect(playBtn).toHaveText('Play');
		for (const arrow of arrows) {
			await expect
				.poll(async () => arrow.evaluate((el) => (el as SVGElement).style.opacity))
				.not.toBe('0');
		}
	}
});
