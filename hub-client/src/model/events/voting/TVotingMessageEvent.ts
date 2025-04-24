import { TBaseEvent } from '../TBaseEvent';
import { TBaseMessageEventContent } from '../TMessageEvent';
import { PubHubsMgType } from '@/logic/core/events';

import { VotingWidget, VotingWidgetType, SchedulerOption, PollOption } from '@/model/events/voting/VotingTypes';

export interface TVotingMessageEvent<C extends TVotingWidgetMessageBaseEvent = TVotingWidgetMessageBaseEvent> extends TBaseEvent {
	content: C;
	type: 'm.room.message';
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
