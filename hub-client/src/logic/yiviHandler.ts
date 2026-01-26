// Packages
import { SecuredRoomAttributeResult } from './logging/statusTypes';
// @ts-expect-error
import yiviClient from '@privacybydesign/yivi-client';
// @ts-expect-error
import yiviCore from '@privacybydesign/yivi-core';
// @ts-expect-error
import yiviWeb from '@privacybydesign/yivi-web';

// Assets
import '@hub-client/assets/yivi.min.css';

import { CONFIG } from '@hub-client/logic/logging/Config';

import { YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
import { EYiviFlow } from '@hub-client/models/yivi/Tyivi';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useSettings } from '@hub-client/stores/settings';

export function yiviFlow(
	flowtype: EYiviFlow.SecuredRoom,
	onFinish: (result: SecuredRoomAttributeResult, threadRoot?: TMessageEvent) => unknown,
	roomId: string,
	elementId: string,
	attributes?: string[],
	message?: string,
	threadRoot?: TMessageEvent,
): void;

export function yiviFlow(
	flowtype: EYiviFlow.Disclosure | EYiviFlow.Sign,
	onFinish: (result: YiviSigningSessionResult, threadRoot?: TMessageEvent) => unknown,
	roomId: string,
	elementId: string,
	attributes?: string[],
	message?: string,
	threadRoot?: TMessageEvent,
): void;

// Implementation signature - use 'any' for the callback parameter
export function yiviFlow(flowtype: EYiviFlow, onFinish: (result: any, threadRoot?: TMessageEvent) => unknown, roomId: string, elementId: string, attributes?: string[], message?: string, threadRoot?: TMessageEvent): void {
	const settings = useSettings();
	const pubhubsStore = usePubhubsStore();
	const accessToken = pubhubsStore.Auth.getAccessToken();

	if (!accessToken) throw new Error('Access token missing.');

	const hubUrl = `${CONFIG._env.HUB_URL}/_synapse/client/ph`;

	// Determine if this flow requires a POST with body
	const isSignatureFlow = flowtype === EYiviFlow.Disclosure || flowtype === EYiviFlow.Sign;

	const session = new yiviCore({
		debugging: false,
		element: elementId,
		language: settings.getActiveLanguage,
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
			},
			result: {
				url: (_o: any, obj: any) => {
					const baseUrl = `${hubUrl}/yivi-endpoint/result?session_token=${obj.sessionToken}`;
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
		.then((result: YiviSigningSessionResult | SecuredRoomAttributeResult) => {
			onFinish(result, threadRoot);
		})
		.catch((error: any) => {
			console.error('Yivi session error:', error);
		});
}
