// Packages
import { SessionManagement, YiviClient as yiviClient } from '@privacybydesign/yivi-client';
import { YiviCore as yiviCore } from '@privacybydesign/yivi-core';
import { YiviWeb as yiviWeb } from '@privacybydesign/yivi-web';

// Assets
import '@hub-client/assets/yivi.min.css';

import { CONFIG } from '@hub-client/logic/logging/Config';
import { createLogger, getLogLevel } from '@hub-client/logic/logging/Logger';

import { type YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';
import { EYiviFlow, type SecuredRoomAttributeResult } from '@hub-client/models/yivi/Tyivi';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useSettings } from '@hub-client/stores/settings';

const logger = createLogger('YiviHandler');

// Override yivi-client url-check method for development. The method is more strict since yivi-client 1.0.1
if (import.meta.env.DEV) {
	type SessionUrlAsserter = { _assertSafeSessionUrl: (url: string) => void };

	(SessionManagement.prototype as unknown as SessionUrlAsserter)._assertSafeSessionUrl = (url: string) => {
		if (typeof url !== 'string' || url.length === 0) throw new Error('Missing or invalid sessionPtr URL in mappings');
		if (url.startsWith('//')) throw new Error(`Refusing to use protocol-relative sessionPtr URL: ${url}`);

		let parsed: URL;
		try {
			parsed = new URL(url, window.location.href);
		} catch {
			throw new Error(`Invalid sessionPtr URL received from server: ${url}`);
		}

		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			throw new Error(`Refusing to use sessionPtr URL with scheme "${parsed.protocol}": ${url}`);
		}
	};
}

export function yiviFlow(
	flowtype: EYiviFlow.SecuredRoom,
	onFinish: (result: SecuredRoomAttributeResult | YiviSigningSessionResult, threadRoot?: TMessageEvent) => unknown,
	roomId: string,
	elementId: string,
	attributes?: string[],
	message?: string,
	threadRoot?: TMessageEvent,
): void;

export function yiviFlow(
	flowtype: EYiviFlow.Disclosure | EYiviFlow.Sign,
	onFinish: (result: YiviSigningSessionResult | SecuredRoomAttributeResult, threadRoot?: TMessageEvent) => unknown,
	roomId: string,
	elementId: string,
	attributes?: string[],
	message?: string,
	threadRoot?: TMessageEvent,
): void;

// Implementation signature
export function yiviFlow(
	flowtype: EYiviFlow,
	onFinish: (result: YiviSigningSessionResult | SecuredRoomAttributeResult, threadRoot?: TMessageEvent) => unknown,
	roomId: string,
	elementId: string,
	attributes?: string[],
	message?: string,
	threadRoot?: TMessageEvent,
): void {
	const settings = useSettings();
	const pubhubsStore = usePubhubsStore();
	const accessToken = pubhubsStore.Auth.getAccessToken();

	if (!accessToken) throw new Error('Access token missing.');

	const hubUrl = `${CONFIG._env.HUB_URL}/_synapse/client/ph`;

	// Determine if this flow requires a POST with body
	const isSignatureFlow = flowtype === EYiviFlow.Disclosure || flowtype === EYiviFlow.Sign;

	const session = new yiviCore({
		debugging: getLogLevel() === 'debug',
		element: elementId,
		language: settings.getActiveLanguage as 'nl' | 'en' | undefined,
		session: {
			url: 'yivi-endpoint',
			start: {
				url: () => `${hubUrl}/yivi-endpoint/start?room_id=${roomId}`,
				method: isSignatureFlow ? 'POST' : 'GET',
				...(isSignatureFlow &&
					attributes &&
					message && {
						body: JSON.stringify({
							'@context': 'https://irma.app/ld/request/signature/v2',
							disclose: attributes.map((attr) => [[attr]]),
							message,
						}),
					}),
				headers: { Authorization: `Bearer ${accessToken}` },
			},
			result: {
				url: (_o: unknown, obj: { sessionToken?: string }) => {
					const baseUrl = `${hubUrl}/yivi-endpoint/result?session_token=${obj.sessionToken ?? ''}`;
					return flowtype === EYiviFlow.SecuredRoom ? `${baseUrl}&room_id=${roomId}` : baseUrl;
				},
				method: isSignatureFlow ? 'POST' : 'GET',
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		},
	});

	session.use(yiviWeb);
	session.use(yiviClient);

	session
		.start()
		.then((result) => {
			onFinish(result as YiviSigningSessionResult | SecuredRoomAttributeResult, threadRoot);
		})
		.catch((error: unknown) => {
			logger.error('Yivi session error:', error);
		});
}
