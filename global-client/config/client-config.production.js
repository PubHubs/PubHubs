// Production config for release builds of the native app. `npm run build:native:release` copies this over
// dist/client-config.js. It is committed so that F-Droid, which builds the app from our source, gets the same
// config as our own builds.
const _env = {
	PUBHUBS_URL: 'https://app.pubhubs.net',
	PHC_URL: 'https://phc.pubhubs.net',
};
