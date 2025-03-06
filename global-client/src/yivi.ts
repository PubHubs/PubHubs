export { yivi };

import { useSettings } from '@/logic/store/store';

function yivi(register: boolean, yivi_token: { value: string }) {
	const settings = useSettings();
	// Include the custom css for the yivi web element
	require('../../hub-client/src/assets/yivi.min.css');

	const yiviCore = require('@privacybydesign/yivi-core');
	const yiviWeb = require('@privacybydesign/yivi-web');
	const yiviClient = require('@privacybydesign/yivi-client');

	const yivi = new yiviCore({
		debugging: false,
		element: register ? '#yivi-register' : '#yivi-login',
		language: settings.getActiveLanguage,
		session: {
			url: 'yivi-endpoint',
			start: {
				url: () => {
					return register ? '/yivi-endpoint/register' : '/yivi-endpoint/start';
				},
			},

			result: false,
		},
	});
	yivi.use(yiviWeb);
	yivi.use(yiviClient);

	yivi.start()
		.then((result: any) => {
			// Set the value of the yivi_token in the form that is to be sent
			// to the finish and redirect endpoint, as the sessiontoken.
			yivi_token.value = result.sessionToken;
		})
		.then(() => {
			// Submit the form with the yivi_token to the finish and redirect endpoint.
			document.forms[0].submit();
		})
		.catch((error: any) => {
			console.info(`An error occured: ${error}`);
		});
}
