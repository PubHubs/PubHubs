// Packages
// @ts-expect-error
import yiviClient from '@privacybydesign/yivi-client';
// @ts-expect-error
import yiviCore from '@privacybydesign/yivi-core';
// @ts-expect-error
import yiviWeb from '@privacybydesign/yivi-web';
import { Ref } from 'vue';

// Assets
import '@hub-client/assets/yivi.min.css';

// Stores
import { useSettings } from '@hub-client/stores/settings';

const startYiviSession = (register: boolean, yivi_token: Ref<string>) => {
	const settings = useSettings();
	const elementId = '#yivi-authentication';
	const endpointBase = '/yivi-endpoint';

	let session;
	try {
		session = new yiviCore({
			debugging: false,
			element: elementId,
			language: settings.getActiveLanguage,
			session: {
				url: endpointBase,
				start: {
					url: () => (register ? `${endpointBase}/register` : `${endpointBase}/start`),
				},
				result: false,
			},
		});

		session.use(yiviWeb);
		session.use(yiviClient);
	} catch (initError) {
		console.error('Yivi initialization failed:', initError);
		throw initError;
	}

	session
		.start()
		.then((result: any) => {
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
		.catch((startError: any) => {
			console.info('Yivi session failed:', startError);
		});
};

const startYiviAuthentication = (yiviRequestorUrl: string, disclosureRequest: string): Promise<string> => {
	const settings = useSettings();
	let yivi;
	try {
		yivi = new yiviCore({
			debugging: false,
			element: '#yivi-authentication',
			language: settings.getActiveLanguage,
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
		yivi.use(yiviWeb);
		yivi.use(yiviClient);
	} catch (initError) {
		console.error('Yivi initialization failed:', initError);
		throw initError;
	}

	return yivi
		.start()
		.then(async (result: { token: string }) => {
			const responseResultJWT = await fetch(`${yiviRequestorUrl}/session/${result.token}/result-jwt`);
			if (responseResultJWT.ok) {
				const resultJWT = await responseResultJWT.text();
				return resultJWT;
			} else {
				const errorText = await responseResultJWT.text();
				throw new Error(`Could not retrieve the Yivi JWT: ${errorText}`);
			}
		})
		.catch((startError: any) => {
			console.error('Yivi session failed:', startError);
		});
};

export { startYiviSession, startYiviAuthentication };
