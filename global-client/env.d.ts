declare const _env: Record<string, string> & {
	PUBHUBS_URL: string;
	PHC_URL: string;
};

// Injected at build time from the git tag via vite.config.ts `define`.
declare const __APP_VERSION__: string;
