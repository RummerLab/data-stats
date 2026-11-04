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

	afterNavigate(() => {
		if (!enabled || typeof window.gtag !== 'function') return;
		const url = page.url;
		window.gtag('event', 'page_view', {
			page_path: `${url.pathname}${url.search}`,
			page_location: url.href,
			page_title: document.title
		});
	});
</script>

<svelte:head>
	{#if enabled}
		<script async src="https://www.googletagmanager.com/gtag/js?id={MEASUREMENT_ID}"></script>
		<script>
			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			window.gtag = gtag;
			gtag('js', new Date());
			gtag('config', 'G-VZF5DR37YH', { send_page_view: false });
		</script>
	{/if}
</svelte:head>
