interface MessageSegment {
	type: 'text' | 'room' | 'user';
	content?: string;
	displayName?: string;
	id: string | null;
	roomId?: string;
	userId?: string;
}

interface MentionMatch {
	type: 'room' | 'user';
	start: number;
	end: number;
	displayName: string;
	id: string;
	roomId?: string;
	userId?: string;
}

export { MessageSegment, MentionMatch };
