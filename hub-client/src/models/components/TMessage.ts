interface MessageSegment {
	type: 'text' | 'room' | 'user';
	content?: string;
	displayName?: string;
	id: string | null;
	roomId?: string;
	userId?: string;
}

interface MentionMatch {
	type: '#' | '@';
	start: number;
	end: number;
	displayName: string;
	mentionId: string;
	id?: string;
}

export { MessageSegment, MentionMatch };
