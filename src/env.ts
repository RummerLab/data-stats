import { defineEnvVars } from '@sveltejs/kit/env';

/** Accept missing/empty values so local + Docker configs stay flexible. */
const optionalString = (value: string | undefined) => value ?? '';

export const variables = defineEnvVars({
	DATA_DIR: {
		description: 'Folder holding the Physioshark spreadsheets (mounted read-only; never edited)',
		schema: optionalString
	},
	DATABASE_PATH: {
		description: 'Derived SQLite cache file (rebuilt whenever the spreadsheets change)',
		schema: optionalString
	},
	EXTERNAL_DIR: {
		description: 'Folder holding the environmental data snapshots (default ./external)',
		schema: optionalString
	},
	PUBLIC_SITE_URL: {
		description: 'Canonical site URL for links and metadata (default http://data.physioshark.org)',
		schema: optionalString
	},
	HOST: { description: 'Listen host', schema: optionalString },
	PORT: { description: 'Listen port', schema: optionalString },
	NODE_ENV: { description: 'Node environment', schema: optionalString }
});
