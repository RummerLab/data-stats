import { dataset } from '#lib/server/data';
import { topFindings } from '#lib/server/analytics/findings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ findings: topFindings(dataset()) });
