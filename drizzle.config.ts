import { defineConfig } from 'drizzle-kit';

// The SQLite file is a derived cache rebuilt from the spreadsheets, so there is no upgrade path
// to protect: regenerate `drizzle/` after editing schema.ts (`pnpm db:generate`) and the next
// import builds a fresh database from it.
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle'
});
