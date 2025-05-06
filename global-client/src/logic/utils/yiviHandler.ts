import { useSettings } from '@/logic/store/store';

const startYiviSession = (register: boolean, yivi_token: { value: string }) => {
	require('@/../../hub-client/src/assets/yivi.min.css');

	const yiviCore = require('@privacybydesign/yivi-core');
	const yiviWeb = require('@privacybydesign/yivi-web');
	const yiviClient = require('@privacybydesign/yivi-client');

	const settings = useSettings();
	const elementId = register ? '#yivi-register' : '#yivi-login';
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

export default startYiviSession;
