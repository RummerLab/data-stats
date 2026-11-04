<script lang="ts">
	/**
	 * GA4 for the Physioshark web stream (G-VZF5DR37YH), shared with physioshark.org.
	 * Enabled only when the request host is a production Physioshark hostname so
	 * localhost / CI / preview never send fixture traffic.
	 */
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';

	const MEASUREMENT_ID = 'G-VZF5DR37YH';

	let { enabled }: { enabled: boolean } = $props();

	// The usual inline gtag snippet can't run here: the CSP only lets SvelteKit's own nonce'd
	// inline scripts through. So the command queue is set up from this bundled code instead,
	// before gtag.js (an allowed external script) arrives and drains it.
	function setup() {
		if (window.gtag) return;
		window.dataLayer = window.dataLayer || [];
		window.gtag = function gtag() {
			// gtag.js only reads Arguments objects from the queue, not arrays.
			window.dataLayer!.push(arguments);
		};
		window.gtag('js', new Date());
		window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
	}

	// Runs in the browser only: after hydration and after every client-side navigation.
	afterNavigate(() => {
		if (!enabled) return;
		setup();
		const url = page.url;
		window.gtag!('event', 'page_view', {
			page_path: `${url.pathname}${url.search}`,
			page_location: url.href,
			page_title: document.title
		});
	});
</script>

<svelte:head>
	{#if enabled}
		<script async src="https://www.googletagmanager.com/gtag/js?id={MEASUREMENT_ID}"></script>
	{/if}
</svelte:head>
