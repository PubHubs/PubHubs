// Production config for release builds of the native app. `npm run build:native:release` copies this over
// dist/client-config.js. It is committed so that F-Droid, which builds the app from our source, gets the same
// config as our own builds.
const _env = {
	PUBHUBS_URL: 'https://app.pubhubs.net',
	PHC_URL: 'https://phc.pubhubs.net',
	// The environment app store reviewers log in to with Yivi demo credentials, see
	// global-client/src/logic/reviewMode.ts.
	REVIEW_PHC_URL: 'https://phc-main.pubhubs.net',
};

// In review mode the app talks to the review environment instead. This has to happen here, before any
// module reads _env; the key is REVIEW_MODE_KEY in reviewMode.ts.
if (localStorage.getItem('ph:review-mode') !== null) {
	_env.PHC_URL = _env.REVIEW_PHC_URL;
}
