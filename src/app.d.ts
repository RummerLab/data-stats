declare global {
	/** package.json version, injected by Vite (`define` in vite.config.ts). */
	const __APP_VERSION__: string;
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
