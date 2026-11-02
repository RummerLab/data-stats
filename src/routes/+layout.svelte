<script lang="ts">
	import '../app.css';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { NAV } from '#lib/nav';
	import { date, season } from '#lib/format';
	import PhysiosharkIcon from '#lib/components/PhysiosharkIcon.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	let menuOpen = $state(false);
	let theme = $state<'system' | 'light' | 'dark'>('system');

	afterNavigate(() => {
		menuOpen = false;
		document
			.querySelectorAll<HTMLDetailsElement>('header details[open]')
			.forEach((d) => (d.open = false));
		const t = document.documentElement.dataset.theme;
		theme = t === 'light' || t === 'dark' ? t : 'system';
	});

	function cycleTheme() {
		theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
		const root = document.documentElement;
		try {
			if (theme === 'system') {
				delete root.dataset.theme;
				localStorage.removeItem('ps_theme');
			} else {
				root.dataset.theme = theme;
				localStorage.setItem('ps_theme', theme);
			}
		} catch {
			/* storage blocked: theme still applies for this page view */
		}
	}

	function onToggle(e: Event) {
		const el = e.currentTarget as HTMLDetailsElement;
		if (el.open)
			document
				.querySelectorAll<HTMLDetailsElement>('header details[open]')
				.forEach((d) => d !== el && (d.open = false));
	}

	const active = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	const version = __APP_VERSION__;
	const description =
		"Thirteen seasons of Physioshark shark-nursery surveys in Mo'orea, French Polynesia, joined with weather, ocean, tide and climate data.";
	const current = $derived(NAV.flatMap((g) => g.items).find((i) => active(i.href)));
	const title = $derived(
		`${current && current.href !== '/' ? `${current.label} · ` : ''}Physioshark Data`
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Physioshark Data" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={`${page.url.origin}${page.url.pathname}`} />
	<meta property="og:image" content={`${page.url.origin}/og-image.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="Physioshark Data: thirteen seasons of baby sharks, in numbers"
	/>
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
	<div class="container bar">
		<a class="brand" href="/" aria-label="Physioshark Data home">
			<img
				class="logo"
				src="/logo-physioshark.png"
				alt=""
				width="498"
				height="174"
				decoding="async"
			/>
			<span class="data">Data</span>
		</a>
		<button
			class="menu-btn"
			aria-expanded={menuOpen}
			aria-controls="site-nav"
			onclick={() => (menuOpen = !menuOpen)}
		>
			<span class="sr">Menu</span>
			<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"
				><path
					d="M4 7h16M4 12h16M4 17h16"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/></svg
			>
		</button>
		<nav id="site-nav" class:open={menuOpen} aria-label="Main">
			{#each NAV as group (group.label)}
				<details ontoggle={onToggle}>
					<summary class:current={group.items.some((i) => active(i.href))}>{group.label}</summary>
					<div class="panel">
						{#each group.items as item (item.href)}
							<a href={item.href} aria-current={active(item.href) ? 'page' : undefined}>
								<span class="l">{item.label}</span>
								<span class="b">{item.blurb}</span>
							</a>
						{/each}
					</div>
				</details>
			{/each}
			<button
				class="theme"
				onclick={cycleTheme}
				aria-label={`Theme: ${theme}. Change theme`}
				title={`Theme: ${theme}`}
			>
				{#if theme === 'dark'}
					<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
						><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" /></svg
					>
				{:else if theme === 'light'}
					<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
						><circle cx="12" cy="12" r="4.5" fill="currentColor" /><path
							d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/></svg
					>
				{:else}
					<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
						><rect
							x="3"
							y="4"
							width="18"
							height="12"
							rx="2"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						/><path
							d="M8 20h8"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/></svg
					>
				{/if}
			</button>
		</nav>
	</div>
</header>

{#if !data.hasData}
	<div class="container">
		<p class="callout">
			No Physioshark spreadsheets were found in <code>DATA_DIR</code>. Environmental data is shown,
			but survey charts are empty until the workbooks are mounted (see the README).
		</p>
	</div>
{/if}

<main id="main">
	{@render children()}
</main>

<footer class="site-footer">
	<div class="container cols">
		<div>
			<p class="fbrand"><PhysiosharkIcon size={36} /> Physioshark Data</p>
			<p>
				An open window onto the Physioshark project's shark-nursery surveys in Mo'orea, French
				Polynesia, led by Dr Jodie Rummer (RummerLab, James Cook University) with CRIOBE.
			</p>
			<p class="small">
				{#if data.seasonRange}Seasons {season(data.seasonRange[0])} to {season(
						data.seasonRange[1]
					)}.{/if}
				{#if data.importedAt}Data imported {date(data.importedAt)}.{/if}
			</p>
			<p class="small">
				<a href={`https://github.com/RummerLab/data-stats/releases/tag/v${version}`}>v{version}</a>
			</p>
		</div>
		<div>
			<p class="fh">Physioshark</p>
			<ul>
				<li><a href="https://physioshark.org/">physioshark.org</a></li>
				<li><a href="https://physioshark.org/#publications">Physioshark publications</a></li>
				<li><a href="https://rummerlab.com/publications">RummerLab publications</a></li>
				<li><a href="https://github.com/RummerLab/data-stats">Source code on GitHub</a></li>
			</ul>
		</div>
		<div>
			<p class="fh">Environmental data</p>
			<p class="small">
				Weather &amp; waves: Open-Meteo (ERA5, CC BY 4.0). SST: NOAA OISST v2.1. Heat stress: NOAA
				Coral Reef Watch via PacIOOS. Tides: UHSLC Papeete gauge. ENSO: NOAA CPC. Coastline ©
				OpenStreetMap contributors.
			</p>
		</div>
	</div>
</footer>

<style>
	.skip {
		position: absolute;
		left: -999px;
		top: 8px;
		background: var(--surface);
		padding: 8px 12px;
		z-index: 50;
	}
	.skip:focus {
		left: 8px;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.site-header {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--hairline);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 64px;
		gap: 16px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: var(--ink);
	}
	.logo {
		display: block;
		height: 40px;
		width: auto;
	}
	/* The two-tone logo is navy on transparent: show it in light ink on dark surfaces. */
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .logo {
			filter: brightness(0) invert(0.94);
		}
	}
	:global(:root[data-theme='dark']) .logo {
		filter: brightness(0) invert(0.94);
	}
	.data {
		font-weight: 700;
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		background: #1d5fb8;
		padding: 2px 8px;
		border-radius: 6px;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	details {
		position: relative;
	}
	summary {
		list-style: none;
		cursor: pointer;
		padding: 8px 12px;
		border-radius: 8px;
		color: var(--ink);
		font-size: 0.94rem;
		user-select: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover,
	details[open] > summary {
		background: var(--surface-2);
	}
	summary.current {
		color: var(--accent-ink);
		font-weight: 600;
	}
	.panel {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: 12px;
		box-shadow: 0 16px 40px rgb(10 25 50 / 0.16);
		padding: 8px;
		width: 300px;
		display: grid;
		gap: 2px;
	}
	.panel a {
		display: grid;
		padding: 8px 10px;
		border-radius: 8px;
		text-decoration: none;
		color: var(--ink);
	}
	.panel a:hover,
	.panel a[aria-current='page'] {
		background: var(--accent-wash);
	}
	.panel .l {
		font-weight: 600;
		font-size: 0.92rem;
	}
	.panel .b {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.theme,
	.menu-btn {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--ink);
		border-radius: 8px;
		padding: 7px;
		cursor: pointer;
		display: inline-flex;
	}
	.theme {
		margin-left: 6px;
	}
	.menu-btn {
		display: none;
	}
	@media (max-width: 860px) {
		.menu-btn {
			display: inline-flex;
		}
		nav {
			display: none;
			position: absolute;
			top: 64px;
			left: 0;
			right: 0;
			flex-direction: column;
			align-items: stretch;
			background: var(--surface);
			border-bottom: 1px solid var(--hairline);
			padding: 8px 16px 16px;
			max-height: calc(100vh - 64px);
			overflow: auto;
		}
		nav.open {
			display: flex;
		}
		.panel {
			position: static;
			width: auto;
			box-shadow: none;
			border: 0;
			padding: 0 0 8px 8px;
		}
		.theme {
			align-self: flex-start;
			margin: 8px 0 0;
		}
	}
	main {
		min-height: 60vh;
		padding-bottom: 56px;
	}
	.site-footer {
		background: var(--navy);
		color: var(--on-navy-2);
		padding: 40px 0;
		font-size: 0.9rem;
	}
	.site-footer a {
		color: var(--on-navy);
	}
	.cols {
		display: grid;
		gap: 24px;
		grid-template-columns: minmax(0, 1fr);
	}
	@media (min-width: 860px) {
		.cols {
			grid-template-columns: 2fr 1fr 1.4fr;
		}
	}
	.fbrand {
		display: flex;
		align-items: center;
		gap: 10px;
		--mark-light: #6bb4d5;
		--mark-dark: var(--on-navy);
		color: var(--on-navy);
		font-weight: 650;
		font-size: 1.05rem;
		margin: 0 0 8px;
	}
	.fh {
		color: var(--on-navy);
		font-weight: 600;
		margin: 0 0 8px;
	}
	.site-footer ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 4px;
	}
	.site-footer p {
		margin: 0 0 8px;
	}
</style>
