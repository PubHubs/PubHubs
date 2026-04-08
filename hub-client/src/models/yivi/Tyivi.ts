type Attribute = {
	attribute: string;
	label?: string;
};

enum EYiviFlow {
	Disclosure = 'disclosure',
	SecuredRoom = 'secured',
	Sign = 'sign',
}

type SecuredRoomAttributeResult = {
	goto: string;
	not_correct: string;
};

export { Attribute, EYiviFlow, type SecuredRoomAttributeResult };
