# OISST restoration validation (#154)

Validated on 4 November 2026. The NOAA `ncdcOisst21Agg` aggregation (requested from
upwell.pfeg.noaa.gov, which redirects it to coastwatch.pfeg.noaa.gov) returns OISST v2.1
final SST at −17.625°, 210.125°E (−149.875°), surface zlev=0.
It omits 19 historical dates despite successful HTTP responses. Those observations
were recovered from NOAA's `oisst_rclone` representation of the same final product,
with the same coordinates and depth=0. No values were interpolated.

The restored column is continuous from 2013-08-01 through 2026-10-19: 4,828 daily
values. Of the snapshot's 4,840 dates, ten use the existing CRW fallback and two
have neither series. Every non-OISST column and the snapshot's dates are unchanged.

[NOAA documents](https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc%3AC01606)
a roughly two-week delay before final OISST is available. The fetch allows 17 days
of lag relative to its requested end (today minus two days), including mirror delay;
older data, missing historical dates or all-null chunks fail before writing.

The real-data validation recomputed analyses against the old CRW-only inputs and
the restored OISST-first inputs. Only aggregate results are recorded here:

| Check                              | CRW-only baseline     | Restored OISST with CRW fallback |
| ---------------------------------- | --------------------- | -------------------------------- |
| Catch-model complete sets          | 1,106                 | 1,107                            |
| Raw catch rate ratio per °C        | 0.748 (0.692–0.808)   | 0.781 (0.726–0.841)              |
| With day of season                 | 1.002 (0.849–1.181)   | 1.045 (0.917–1.192)              |
| Fully adjusted                     | 0.939 (0.772–1.142)   | 0.974 (0.835–1.136)              |
| Nursery minus satellite daily mean | +0.43 °C, 2,715 pairs | +0.42 °C, 2,716 pairs            |

Intervals are 95% Wald intervals. The adjusted SST interval still includes 1; the
calendar explanation remains supported. Seasonal sampling-night mean SST changes
range from −0.078 to +0.247 °C. Ocean and season charts compute their summaries live.
These exploratory associations do not establish causation.

No importer logic changed: the external-file fingerprint already rebuilds deployed
caches. Shared source copy describes both products and /ocean displays live source
coverage. `node scripts/fetch-external.mjs --only=oisst` repairs the OISST column
without refreshing independent wave or CRW variables.

Validation: fetch regression tests (included in `pnpm test`), lint, Svelte
checks, unit tests, read-only real-data import and analysis comparison, production
build, and Playwright/axe. The private comparison output stays in ignored cache/.
