type DisclosedAttribute = {
	id: string;
	issuancetime: number;
	rawvalue: string;
	status: string;
	value: {
		'': string;
		en: string;
		nl: string;
	};
};

export type DisclosureAttribute = {
	yivi: string;
	values: string;
};

export type AskDisclosure = {
	user: { userId: string; displayName?: string }; // subset of MatrixUser
	message: string;
	attributes: DisclosureAttribute[];
	where_room: string;
};

export type AskDisclosureMessage = {
	userId: string;
	replyToRoomId: string;
	message: string;
	attributes: DisclosureAttribute[];
};

type YiviSignedMessage = {
	message: string;
};

export type YiviSigningSessionResult = {
	token: string;
	status: string;
	type: string;
	proofStatus: string;

	disclosed: DisclosedAttribute[][];
	signature: YiviSignedMessage;
};

export type SignedMessage = YiviSigningSessionResult;

export function getMessage(message: SignedMessage): string {
	return message.signature?.message || '';
}

export function getDisclosedAttributes(message: SignedMessage): DisclosedAttribute[] {
	if (message.disclosed) {
		return message.disclosed[0] || [];
	}
	return [];
}

export const EXAMPLE_SESSION_RESULT = {
	disclosed: [
		[
			{
				id: 'pbdf.sidn-pbdf.email.email',
				issuancetime: 1693440000,
				rawvalue: 'aron.schoeffer@ru.nl',
				status: 'PRESENT',
				value: {
					'': 'aron.schoeffer@ru.nl',
					en: 'aron.schoeffer@ru.nl',
					nl: 'aron.schoeffer@ru.nl',
				},
			},
		],
	],
	proofStatus: 'VALID',
	signature: {
		'@context': 'https://irma.app/ld/signature/v2',
		context: 'AQ==',
		indices: [
			[
				{
					attr: 2,
					cred: 0,
				},
			],
		],
		message:
			'test messageContrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum',
		nonce: '7U75BwnKZPWiiVvYI+hBMA==',
		signature: [
			{
				A: 'Kfax5nHKH7iK8k8PDsL14UPRbi2p4QF1otPqdZ5I1lMqdrFdXYWg3qztzbWbkEa5auKBwT5nb3/0DM7XNRrVYLxAMOdG+L1FIyCO6sSl61ANDPShjG487NHjCG7JekoVMLuHwuzqKop+xcz6J6SAyPF1gWnBWfnB0Kid1vtAzI3xv7ks+WpHqdq++gJn9QM+UNoGYu+p2bc0DLwtktn7EgfrujTG8Lp+jrGKuTIYUctJkmlUdKPqPXnXAh+awWDL1XCX7AE5x5JlLmRIVFuwxaVNQ39IoOLsAT7LOwUv0QG/6QhTeRgN+dkFovGrWHg90faai1YfaH/zqJE3on3WqQ==',
				a_disclosed: {
					1: 'AwAK8AA0AAA8QFu1pJs7d7jUZJ7JsgaJ',
					2: 'wuTe3FzmxtDeyszMyuSA5Opc3Nk=',
				},
				a_responses: {
					0: 'JsN44/TgL2ieRwvUGdRz+8sLrirV8Boi6i3oLTof5wi8gB23lBd9Vo7Ou4y+vfNWnwwFuE75cUpRo3QhrRzave4zeZJx5+zcFYo0dbhXMHs=',
					3: 'GIkalhEft/+tKCdL6Eq8KqUzYS3d9/OldffBY/Lb/H8jC/vGmo/l8/uxm6ehQHHRwuQOD5M0SF+wD/Q/wy1GRvbAdXF52oeGX6idzTMJ5B8=',
				},
				c: 'fdCnbgA7/fvKOu6UOJjOFt8vKA1RQeTLDAyoGq6Jg/w=',
				e_response: 'rb4YDly205U+Lo4vc74/cQO5V8DB/AqXhTrMr1V1Eb3exOtluaKv4mCRnd69uJLckSIr1Wgkkcy0E7hH5urE',
				v_response:
					'A1+/NmYLNTJ/QJJpuBn8k7+QTRZ0NZpBvq9uYIOd2ShYPeWa7G2MusVUcyGCp/CWUIswCYxHQisLtmscxGQmOHV/oQcXnPYlXDuXC5y7z9l2EKwF0aZzAxqM5J8eP2PFzquabnNK1SmmPWVfD7J1PCWHDjsbcmjBYkl32qMsYsLUza3B5nPQTZDwTwdyc+nGiy4REa+o2eOH5Pwwr4EdIKbmbcFjiiI9c/ujcLc9F5fOhv/GnFbAyeGa483/rOLsN41zAvERoryr/xHSfaSN7+5tkA8O0h01JZItKvLmV3O3nxhKik12KsDvjktRK6pSY3Z+UkD74WSjdr9iJOE3fjZNIJqltJntNiPUF987poCXO4BfpaYTDd5RGrYnB+d0aDs+qlfvG6c19D8CUMVZzV7/Q+Iej8+8xO9H3LrwiQ7rbqgnoQRHh6Vr0SsGYVJuNxIkZS2R7xje9nK1X6qB/63tf58MqJ/64eojBn8V4pGw+INL8oFVpFt1OoBbZcmSgXySPvtrDyPNa/Ne7YraVGM=',
			},
		],
		timestamp: {
			ServerUrl: 'https://irma.sidn.nl/atumd/',
			Sig: {
				Alg: 'ed25519',
				Data: 'BMlgiY+WiTtuDnEBgmvuQ8eOHbyR2goBiLp/+MZ2zsFSepzLYaYj5bWGIrcjNM/g2G4MNywF/DgxFqpg+y2HCA==',
				PublicKey: 'XqKPue9V0YMZuDxo6/gcaFiy314myUQECDbw1qmePYY=',
			},
			Time: 1699955620,
		},
	},
	status: 'DONE',
	token: 'az43eZsuIgzXfKOhz1RY',
	type: 'signing',
};
