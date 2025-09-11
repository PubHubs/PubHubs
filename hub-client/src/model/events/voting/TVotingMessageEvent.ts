import { EventType } from 'matrix-js-sdk';
import { TBaseEvent } from '@/model/events/TBaseEvent.js';
import { TBaseMessageEventContent } from '@/model/events/TMessageEvent.js';
import { PubHubsMgType } from '@/logic/core/events.js';

import { VotingWidget, VotingWidgetType, SchedulerOption, PollOption } from '@/model/events/voting/VotingTypes.js';

export interface TVotingMessageEvent<C extends TVotingWidgetMessageBaseEvent = TVotingWidgetMessageBaseEvent> extends TBaseEvent {
	content: C;
	type: EventType.RoomMessage;
}

export interface TVotingWidgetMessageBaseEvent extends TBaseMessageEventContent {
	title: string;
	location?: string;
	description: string;
	options: Array<PollOption | SchedulerOption>;
	type: VotingWidgetType;
	showVotesBeforeVoting: boolean;
}

export interface TVotingWidgetMessageEventContent extends TVotingWidgetMessageBaseEvent {
	msgtype: PubHubsMgType.VotingWidget;
}

export interface TVotingWidgetEditEventContent extends TVotingWidgetMessageBaseEvent {
	msgtype: PubHubsMgType.VotingWidgetEdit;
}

export interface TVotingWidgetVote extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VotingWidgetVote;
	optionId: number;
	vote: string;
}

export interface TVotingWidgetClose extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VotingWidgetClose;
	'm.mentions': {
		user_ids: string[];
	};
}

export interface TVotingWidgetOpen extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VotingWidgetOpen;
	'm.mentions': {
		user_ids: string[];
	};
}

export interface TVotingWidgetPickOption extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VotingWidgetPickOption;
	optionId: number;
}

export interface TVotingWidgetAddVoteOption extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VotingWidgetAddVoteOption;
	optionId: number;
}

export interface TVotingWidgetChangeDetails extends TBaseMessageEventContent {
	msgtype: PubHubsMgType.VotingWidgetEdit;
	votingWidget: VotingWidget;
}
