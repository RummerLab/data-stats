<script lang="ts">
	import { PUBLICATIONS } from '#lib/publications';
	import { date } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const moorea = PUBLICATIONS.filter((p) => p.moorea);
	const other = PUBLICATIONS.filter((p) => !p.moorea);
</script>

<div class="container prose">
	<header class="page-head">
		<p class="eyebrow">About</p>
		<h1>About &amp; methods</h1>
		<p class="lede">
			Physioshark Data is an open window onto the <a href="https://physioshark.org/"
				>Physioshark project</a
			>'s shark-nursery surveys in Mo'orea, French Polynesia, led by Dr Jodie Rummer (RummerLab,
			James Cook University) in collaboration with CRIOBE. Since 2013, field teams have set gillnets
			across Mo'orea's shallow nurseries each pupping season to catch, measure, tag and release
			newborn blacktip reef sharks and sicklefin lemon sharks.
		</p>
	</header>

	<section class="section">
		<h2>Where the numbers come from</h2>
		<ul>
			<li>
				<b>Shark and set logs</b> (one workbook per season, 2013–14 onward), the adult blacktip datasheet,
				nursery logger GPS and the anthropogenic pressure ranking. The workbooks are the source of truth:
				this site only reads them, never edits them, and is rebuilt automatically when a new or updated
				workbook is added.
			</li>
			<li>
				<b>In-situ temperature loggers:</b> raw CSV exports from the HOBO pendants and EnvLoggers left
				in the nurseries, matched to a nursery by the phone's GPS at download, the logger register, the
				logger's name or the season workbooks' HOBO log. Times are converted to Mo'orea time; downloads
				of the same logger are merged, and the first and last hours of each deployment and readings outside
				15–40 °C are dropped. Each download is checked against the loggers at the other nurseries; one
				that barely follows the lagoon's daily cycle (a logger out of the water, say) is left out.
			</li>
			<li>
				<b>Weather:</b> hourly and daily ERA5 reanalysis via the
				<a href="https://open-meteo.com/">Open-Meteo</a> Historical Weather API (CC BY 4.0).
			</li>
			<li><b>Waves:</b> ERA5-ocean via the Open-Meteo Marine API.</li>
			<li><b>Sea-surface temperature:</b> NOAA OISST v2.1 daily, via NOAA CoastWatch ERDDAP.</li>
			<li>
				<b>Heat stress:</b> NOAA Coral Reef Watch 5 km daily SST anomaly, HotSpot and Degree Heating Weeks,
				via PacIOOS ERDDAP.
			</li>
			<li>
				<b>Tides:</b> University of Hawaii Sea Level Center fast-delivery hourly sea level, Papeete (station
				015).
			</li>
			<li>
				<b>El Niño:</b> NOAA Climate Prediction Center Oceanic Niño Index and Southern Oscillation Index.
			</li>
			<li>
				<b>Sun and moon:</b> computed for Mo'orea (17.53° S, 149.83° W, UTC−10) from standard astronomical
				formulas.
			</li>
			<li><b>Coastline:</b> © OpenStreetMap contributors (ODbL), simplified.</li>
		</ul>
		<p class="small muted">
			Last import {date(data.importedAt)}. Environmental data to {date(data.external.weather)} (weather),
			{date(data.external.ocean)}
			(ocean) and {date(data.external.tide)} (tide).
		</p>
	</section>

	<section class="section">
		<h2>How the data are cleaned</h2>
		<ul>
			<li>
				Thirteen seasons use different sheet layouts and headers. Columns are matched by name
				aliases, not position.
			</li>
			<li>
				Lengths are stored in millimetres. Sheets recorded in centimetres (2013–15 and the 2021–22
				logs, despite "mm" headers) are detected from their median values and converted; every
				conversion is listed on
				<a href="/data-quality">Data quality</a>.
			</li>
			<li>
				Dates that fall a year outside their season (for example "2014-01-11" in the 2014–15 log)
				are corrected and flagged.
			</li>
			<li>
				Individual sharks are linked across captures and seasons by PIT tag or COFA dart tag
				(including re-tagging), and by the recapture groupings in the 2013–15 workbooks.
			</li>
			<li>
				Captures are linked to their set by season and set number, falling back to date and nursery.
			</li>
			<li>
				Catch per unit effort (CPUE) is sharks per hour of gillnet, recomputed from net-in and
				net-out times. 2013–14 logs have no times, so that season has catches but no CPUE.
			</li>
			<li>
				Size and condition analyses use each shark's first capture of a season. Newborns are sharks
				recorded as neonates or with an open or healing umbilical scar. Condition is Fulton's K =
				100 × mass (g) / total length (cm)³.
			</li>
			<li>
				Correlations are Spearman rank correlations with simple p-values, not models: treat them as
				leads. Variables overlap, and multiple comparisons inflate false positives.
			</li>
		</ul>
	</section>

	<section class="section">
		<h2>Publications from the Mo'orea fieldwork</h2>
		<ul class="pubs">
			{#each moorea as p (p.doi)}
				<li>
					{p.authors} ({p.year}). <a href={`https://doi.org/${p.doi}`}>{p.title}</a>.
					<i>{p.journal}</i>.
					<span class="tag">See: <a href={p.moorea!.href}>{p.moorea!.label}</a></span>
				</li>
			{/each}
		</ul>
		<h2>Other Physioshark publications</h2>
		<ul class="pubs">
			{#each other as p (p.doi)}
				<li>
					{p.authors} ({p.year}). <a href={`https://doi.org/${p.doi}`}>{p.title}</a>.
					<i>{p.journal}</i>.
				</li>
			{/each}
		</ul>
		<p>
			Full and up-to-date lists: <a href="https://physioshark.org/#publications"
				>Physioshark publications</a
			>
			and <a href="https://rummerlab.com/publications">RummerLab publications</a>.
		</p>
	</section>

	<section class="section">
		<h2>Open source</h2>
		<p>
			The site's code is on <a href="https://github.com/RummerLab/data-stats">GitHub</a> (SvelteKit, Drizzle,
			SQLite). The raw spreadsheets are not published there; ideas, bugs and questions about the data
			are tracked as GitHub issues.
		</p>
	</section>
</div>

<style>
	.prose ul {
		padding-left: 20px;
		display: grid;
		gap: 6px;
		max-width: 860px;
	}
	.pubs li {
		line-height: 1.5;
	}
	.section h2 {
		margin-top: 24px;
	}
</style>
