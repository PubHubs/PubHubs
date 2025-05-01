enum VotingWidgetType {
	POLL = 'poll',
	SCHEDULER = 'scheduler',
}

interface vote {
	choice?: string;
	//TODO: remove userIds and use userTime everywhere, since that stores the userId as the first part of the tuple
	userIds: Array<string>;
	userTime?: Array<[string, string]>;
}

interface votesForOption {
	optionId: number;
	votes: vote[];
}

class VotingOptions {
	options: votesForOption[] = [];

	removeRedactedVotes() {
		for (const option of this.options) {
			for (const userChoices of option.votes) {
				if (userChoices.choice == 'redacted') {
					userChoices.userIds = [];
					userChoices.userTime = [];
				}
			}
		}
	}

	newVotes(votesToCopy: votesForOption[]) {
		const newVotes = new Array<votesForOption>();
		for (const vfo of votesToCopy) {
			const newvFo: votesForOption = {
				optionId: vfo.optionId,
				votes: [],
			};
			for (const vote of vfo.votes) {
				const newUserIds = [];
				const newUserTime = [];
				for (const user of vote.userIds) {
					newUserIds.push(user);
				}
				for (const time of vote.userTime!) {
					newUserTime.push(time);
				}
				newvFo.votes.push({
					choice: vote.choice,
					userIds: newUserIds,
					userTime: newUserTime,
				});
			}
			newVotes.push(newvFo);
		}
		this.options = newVotes;
	}
}

class VotingWidget {
	title: string;
	description: string;
	type: VotingWidgetType;
	options: PollOption[] | SchedulerOption[] = [];
	location: undefined | string;
	protected optionId: number = 0;
	maxOptions: number = 100;
	showVotesBeforeVoting: boolean = false;

	constructor(title: string = '', description: string = '', type: VotingWidgetType = VotingWidgetType.POLL, showVotes: boolean = false) {
		this.title = title;
		this.description = description;
		this.type = type;
		this.showVotesBeforeVoting = showVotes;
	}

	removeExcessOptions() {
		if (this.options.length > this.maxOptions) {
			this.options.splice(this.maxOptions, this.options.length - this.maxOptions);
		}
	}

	updateOptionsId() {
		this.optionId = Math.max(...this.options.map((option) => option.id)) + 1;
	}
}

/**
 * Polling
 */

interface PollOption {
	id: number;
	title: string;
}

class Poll extends VotingWidget {
	options: PollOption[];

	constructor(title: string = '', description: string = '', showVotes: boolean = false, options?: PollOption[]) {
		super(title, description, VotingWidgetType.POLL, showVotes);
		if (options) {
			this.options = options;
		} else {
			this.options = [
				{ id: this.optionId++, title: '' },
				{ id: this.optionId++, title: '' },
			];
		}
	}

	canSend() {
		const filteredOptions = this.options.filter((option) => option.title !== '');
		return this.title !== '' && filteredOptions.length >= 2;
	}

	removeOption(id: number) {
		this.options = this.options.filter((option) => option.id !== id);
		this.addNewOptionsIfAllFilled();
	}

	removeEmptyOptions() {
		this.options = this.options.filter((option) => option.title !== '');
	}

	addDeepCopyOfPollOptions(optionsToCopy: PollOption[]) {
		const newPollOptions: PollOption[] = new Array<PollOption>();
		for (const option of optionsToCopy) {
			const newPollOpt: PollOption = {
				id: option.id,
				title: option.title,
			};
			newPollOptions.push(newPollOpt);
		}
		this.options = newPollOptions;
	}

	addNewOptionsIfAllFilled() {
		while (this.options.length < 2 || this.options.every((option) => option.title !== '')) {
			this.options.push({ id: this.optionId++, title: '' });
		}
	}
}

/**
 * Scheduler
 */

enum SchedulerOptionStatus {
	EMPTY = 'empty',
	FILLING = 'filling',
	FILLED = 'filled',
}

interface SchedulerOption {
	id: number;
	status: SchedulerOptionStatus;
	date: Date[];
}

class Scheduler extends VotingWidget {
	location: string;
	options: SchedulerOption[] = [
		{
			id: this.optionId++,
			status: SchedulerOptionStatus.EMPTY,
			date: [],
		},
	];

	constructor(title: string = '', description: string = '', location: string = '', showVotes: boolean = false, options?: SchedulerOption[]) {
		super(title, description, VotingWidgetType.SCHEDULER, showVotes);
		if (options) {
			this.options = options;
		}
		this.location = location;
	}

	canSend() {
		// Check if the title is not empty and there is at least one option with status FILLED
		return this.title !== '' && this.options.some((option) => option.status === SchedulerOptionStatus.FILLED);
	}

	removeOption(id: number) {
		this.options = this.options.filter((option) => option.id !== id);
		this.addNewOptionsIfAllFilled();
	}

	removeEmptyOptions() {
		this.options = this.options.filter((option) => option.status === SchedulerOptionStatus.FILLED);
	}

	addDeepCopyOfSchedulerOptions(optionsToCopy: SchedulerOption[]) {
		const newSchedulerOptions: SchedulerOption[] = new Array<SchedulerOption>();
		for (const option of optionsToCopy) {
			const newSchedulerOpt: SchedulerOption = {
				id: option.id,
				status: option.status,
				date: option.date,
			};
			newSchedulerOptions.push(newSchedulerOpt);
		}
		this.options = newSchedulerOptions;
	}

	addNewOptionsIfAllFilled() {
		if (this.options.length < 1 || this.options.every((option) => option.status === SchedulerOptionStatus.FILLED)) {
			this.options.push({
				id: this.optionId++,
				status: SchedulerOptionStatus.EMPTY,
				date: [],
			});
		}
	}
}

export { vote, votesForOption, VotingOptions, VotingWidgetType, VotingWidget, Poll, PollOption, Scheduler, SchedulerOption, SchedulerOptionStatus };
