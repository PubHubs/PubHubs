interface MessageSegment {
	type: 'text' | 'room' | 'user';
	content?: string;
	id: string | null;
	tokenId?: string;
}

interface MentionMatch {
	type: '#' | '@' | null;
	start: number;
	end: number;
	displayName: string;
	id: string;
	tokenId?: string;
}

export { MessageSegment, MentionMatch };
