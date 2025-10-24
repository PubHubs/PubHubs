// Packages
import { EventType } from 'matrix-js-sdk';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';

// Models
import { TBaseEvent } from '@hub-client/models/events/TBaseEvent';
import { TBaseMessageEventContent } from '@hub-client/models/events/TMessageEvent';
import { PollOption, SchedulerOption, VotingWidget, VotingWidgetType } from '@hub-client/models/events/voting/VotingTypes';

// Types
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
