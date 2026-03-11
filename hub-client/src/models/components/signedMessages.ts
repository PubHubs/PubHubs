import { Attribute } from '../yivi/Tyivi';

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
	user: { name: string; displayname?: string }; // subset of TUserAccount
	message: string;
	attributes: Attribute[];
	where_room: { room_id: string; name: string }; // subset of PublicRoom
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
