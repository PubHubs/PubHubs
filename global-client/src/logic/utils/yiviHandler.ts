// Packages
import { YiviClient } from '@privacybydesign/yivi-client';
import { YiviCore } from '@privacybydesign/yivi-core';
import { YiviWeb } from '@privacybydesign/yivi-web';
import { type Ref } from 'vue';

// Assets
import '@hub-client/assets/yivi.min.css';

import { createLogger } from '@hub-client/logic/logging/Logger';
import { allowInsecureYiviSessionUrlsInDev } from '@hub-client/logic/utils/yiviSessionUrl';

// Stores
import { useSettings } from '@hub-client/stores/settings';

const logger = createLogger('YiviHandler');

allowInsecureYiviSessionUrlsInDev();

/**
 * Whether the Yivi widget will offer a link that opens the Yivi app on this device, rather than a
 * QR code to be scanned with a second device.
 *
 * Mirrors the platform check in `@privacybydesign/yivi-client`'s `user-agent.js`
 */
const canOpenYiviApp = (): boolean => {
	if (typeof window === 'undefined') return false;

	const userAgent = window.navigator.userAgent;

	if (/Android/i.test(userAgent)) return true;
	if (/iPad|iPhone|iPod/.test(userAgent)) return true;

	// iPadOS 13 and up report themselves as a Mac; the touch points give them away.
	return /Macintosh/.test(userAgent) && window.navigator.maxTouchPoints > 2;
};

const startYiviSession = (register: boolean, yivi_token: Ref<string>) => {
	const settings = useSettings();
	const elementId = '#yivi-authentication';
	const endpointBase = '/yivi-endpoint';

	let session;
	try {
		session = new YiviCore({
			debugging: false,
			element: elementId,
			language: settings.getActiveLanguage as 'nl' | 'en' | undefined,
			session: {
				url: endpointBase,
				start: {
					url: () => (register ? `${endpointBase}/register` : `${endpointBase}/start`),
				},
				result: false,
			},
		});

		session.use(YiviWeb);
		session.use(YiviClient);
	} catch (initError) {
		logger.error('Yivi initialization failed:', initError);
		throw initError;
	}

	session
		.start()
		.then((response: unknown) => {
			const result = response as { sessionToken?: string };

			if (!result || !result.sessionToken) {
				throw new Error('Missing sessionToken in Yivi response');
			}

			// Set the value of the yivi_token in the form that is to be sent
			// to the finish and redirect endpoint, as the sessiontoken.
			yivi_token.value = result.sessionToken;
		})
		.then(() => {
			// Submit the form with the yivi_token to the finish and redirect endpoint.
			const form = document.forms[0];

			if (!(form instanceof HTMLFormElement)) {
				throw new Error('No form detected to submit Yivi token');
			}

			form.submit();
		})
		.catch((startError: unknown) => {
			logger.info('Yivi session failed:', startError);
		});
};

const startYiviAuthentication = (yiviRequestorUrl: string, disclosureRequest: string): Promise<string> => {
	const settings = useSettings();
	let yivi;
	try {
		yivi = new YiviCore({
			debugging: false,
			element: '#yivi-authentication',
			language: settings.getActiveLanguage as 'nl' | 'en' | undefined,
			session: {
				url: yiviRequestorUrl,
				start: {
					method: 'POST',
					body: disclosureRequest,
					headers: { 'Content-Type': 'text/plain' },
				},
			},
			state: {
				pairing: false,
			},
		});
		yivi.use(YiviWeb);
		yivi.use(YiviClient);
	} catch (initError) {
		logger.error('Yivi initialization failed:', initError);
		throw initError;
	}

	return yivi
		.start()
		.then(async (response: unknown) => {
			const result = response as { token: string };

			const responseResultJWT = await fetch(`${yiviRequestorUrl}/session/${result.token}/result-jwt`);
			if (responseResultJWT.ok) {
				const resultJWT = await responseResultJWT.text();
				return resultJWT;
			} else {
				const errorText = await responseResultJWT.text();
				throw new Error(`Could not retrieve the Yivi JWT: ${errorText}`);
			}
		})
		.catch((startError: unknown) => {
			// Rethrow. A caller that cannot tell a finished session from a failed one would carry an
			// `undefined` disclosure into the next request, or report a PubHubs card as issued that
			// never reached the user's Yivi app.
			logger.error('Yivi session failed:', startError);
			throw startError instanceof Error ? startError : new Error(`Yivi session failed: ${String(startError)}`);
		});
};

export { canOpenYiviApp, startYiviSession, startYiviAuthentication };
