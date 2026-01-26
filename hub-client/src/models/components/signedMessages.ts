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
	attributes: string[];
	where_room: string;
};

export type AskDisclosureMessage = {
	userId: string;
	replyToRoomId: string;
	message: string;
	attributes: string[];
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
		return message.disclosed.flat() || [];
	}
	return [];
}
