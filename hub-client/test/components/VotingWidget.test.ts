import { Poll, PollOption, Scheduler, SchedulerOption, VotingOptions, VotingWidgetType } from '@hub-client/models/events/voting/VotingTypes';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// Components
import Icon from '@hub-client/components/elements/Icon.vue';
// Models
import { TVotingWidgetMessageEventContent } from '@hub-client/models/events/voting/TVotingMessageEvent';
import VotingWidget from '@hub-client/components/rooms/voting/VotingWidget.vue';
// Packages
import { config } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { en } from '@hub-client/locales/en';
import { mount } from '@vue/test-utils';
// Locales
import { nl } from '@hub-client/locales/nl';
// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useUser } from '@hub-client/stores/user';

// Add to VotingWidget-test-setup.ts
config.global.mocks = {
	$t: (tKey) => tKey,
};

describe('VotingWidget functions', () => {
	let i18n;
	const fallbackLanguage = 'en';

	beforeEach(() => {
		setActivePinia(createPinia());

		const user = useUser();

		user.client = {
			getUser: vi.fn().mockReturnValue({ displayName: 'Test User' }),
		};
		// Options cloned from main code - see hub-client/src/i18n.ts
		i18n = createI18n({
			legacy: false,
			warnHtmlMessage: false,
			globalInjection: true,
			locale: fallbackLanguage,
			fallbackLocale: fallbackLanguage,
			messages: {
				nl: nl,
				en: en,
			},
		});

		// Mock access token before each test
		const pubhubs = usePubhubsStore();
		const accessTokenMock = vi.fn();
		pubhubs.Auth.getAccessToken = accessTokenMock;
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	test('initializeVotesByOption initializes votes correctly for scheduler type', () => {
		// Use date of the system to test functions
		const date = new Date();
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				event: {
					content: {
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [
							{ id: 1, date: date },
							{ id: 2, date: date },
						],
						type: 'scheduler',
					},
					event_id: 'TEST',
				},
			},
		});
		// Call the function and test if it was called
		const initializeVotesByOptionSpy = vi.spyOn(wrapper.vm, 'initializeVotesByOption');
		const result = wrapper.vm.initializeVotesByOption(wrapper.vm.props.event.content.options);
		expect(initializeVotesByOptionSpy).toHaveBeenCalled();
		// Add array of expected votes
		const expectedVotes = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{ choice: 'maybe', userIds: [], userTime: [] },
					{ choice: 'no', userIds: [], userTime: [] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
			{
				optionId: 2,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{ choice: 'maybe', userIds: [], userTime: [] },
					{ choice: 'no', userIds: [], userTime: [] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
		];
		// Check if votes are initialized correctly
		expect(result).toEqual(expectedVotes);
	});

	test('initializeVotesByOption initializes votes correctly for poll type', () => {
		// Mount the component 'VotingWidget' with props
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				event: {
					content: {
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [{ id: 1 }, { id: 2 }],
						type: 'poll',
					},
					event_id: 'TEST',
				},
			},
		});

		// Call the function
		const initializeVotesByOptionSpy = vi.spyOn(wrapper.vm, 'initializeVotesByOption');
		const result = wrapper.vm.initializeVotesByOption(wrapper.vm.props.event.content.options);
		expect(initializeVotesByOptionSpy).toHaveBeenCalled();
		// Add array of expected votes
		const expectedVotes = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
			{
				optionId: 2,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
		];
		// Check if votes are initialized correctly
		expect(result).toEqual(expectedVotes);
	});

	test('removeRedactedVotes correctly removes redacted votes for scheduler type', () => {
		// Use date of the system to test functions
		const date = new Date();
		const votesByOption = new VotingOptions();
		votesByOption.options = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{
						choice: 'maybe',
						userIds: ['2', '3'],
						userTime: ['12:20', '12:21'],
					},
					{ choice: 'no', userIds: ['1'], userTime: ['12:34'] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
			{
				optionId: 2,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{ choice: 'maybe', userIds: [], userTime: [] },
					{ choice: 'no', userIds: ['2', '3'], userTime: [] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
		];
		// Mount the component with the relevant events
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				event: {
					content: {
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [
							{ id: 1, date: date },
							{ id: 2, date: date },
						],
						type: 'scheduler',
					},
					event_id: 'TEST',
				},
			},
		});
		// Set the votesByOption field of the mocked component (cant do this when mounting)
		votesByOption.removeRedactedVotes();
		wrapper.vm.votesByOption = votesByOption;
		// Add array of expected votes
		const expectedVotes = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{
						choice: 'maybe',
						userIds: ['2', '3'],
						userTime: ['12:20', '12:21'],
					},
					{ choice: 'no', userIds: ['1'], userTime: ['12:34'] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
			{
				optionId: 2,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{ choice: 'maybe', userIds: [], userTime: [] },
					{ choice: 'no', userIds: ['2', '3'], userTime: [] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
		];
		// Check if votes are initialized correctly
		expect(wrapper.vm.votesByOption.options).toEqual(expectedVotes);
	});

	test('removeRedactedVotes correctly removes redacted votes for poll type', () => {
		// Use date of the system to test functions
		const date = new Date();
		const votesByOption = new VotingOptions();
		votesByOption.options = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: ['12'], userTime: ['12:30'] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
			{
				optionId: 2,
				votes: [
					{ choice: 'yes', userIds: ['1'], userTime: ['00:12'] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
		];

		// Mount the component with the relevant events
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				event: {
					content: {
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [
							{ id: 1, date: date },
							{ id: 2, date: date },
						],
						type: 'Poll',
					},
					event_id: 'TEST',
				},
			},
		});

		// Set the votesByOption field of the mocked component (cant do this when mounting)
		votesByOption.removeRedactedVotes();
		wrapper.vm.votesByOption = votesByOption;
		// Add array of expected votes
		const expectedVotes = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: ['12'], userTime: ['12:30'] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
			{
				optionId: 2,
				votes: [
					{ choice: 'yes', userIds: ['1'], userTime: ['00:12'] },
					{ choice: 'redacted', userIds: [], userTime: [] },
				],
			},
		];
		// Check if votes are initialized correctly
		expect(wrapper.vm.votesByOption.options).toEqual(expectedVotes);
	});

	test('sort_score scores data correctly', () => {
		// Use date of the system to test functions
		const date = new Date();
		// Mount the component with the relevant events
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				event: {
					content: {
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [
							{ id: 1, date: date },
							{ id: 2, date: date },
						],
						type: 'scheduler',
					},
					event_id: 'TEST',
				},
			},
		});
		// Add data to test the scoring function on
		const data = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: [], userTime: [] },
					{
						choice: 'maybe',
						userIds: ['2', '3'],
						userTime: ['12:20', '12:21'],
					},
					{ choice: 'no', userIds: ['1'], userTime: ['12:34'] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
			{
				optionId: 2,
				votes: [
					{ choice: 'yes', userIds: ['1'], userTime: [] },
					{ choice: 'maybe', userIds: [], userTime: [] },
					{ choice: 'no', userIds: ['2', '3'], userTime: [] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
		];
		// Call the function
		const sort_scoreSpy = vi.spyOn(wrapper.vm, 'sort_score');
		const res1 = wrapper.vm.sort_score(data[0]);
		const res2 = wrapper.vm.sort_score(data[0]);
		expect(sort_scoreSpy).toBeCalledTimes(2);

		// Check if the scoring was done correctly
		expect(res1).toBe(1);
		expect(res2).toBe(1);
	});

	test('get_sorted_votes_for_scheduler sorts the options correctly', () => {
		// Use date of the system to test functions
		const date = new Date();
		const votesByOption = new VotingOptions();
		votesByOption.options = [
			{
				optionId: 1,
				votes: [
					{ choice: 'yes', userIds: ['4'], userTime: ['15:09'] },
					{
						choice: 'maybe',
						userIds: ['2', '3'],
						userTime: ['12:20', '12:21'],
					},
					{ choice: 'no', userIds: ['1'], userTime: ['12:34'] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
			{
				optionId: 2,
				votes: [
					{
						choice: 'yes',
						userIds: ['1', '4', '5'],
						userTime: ['12:20', '12:21', '15:00'],
					},
					{ choice: 'maybe', userIds: [], userTime: [] },
					{ choice: 'no', userIds: ['2', '3'], userTime: ['12:20', '12:21'] },
					{
						choice: 'redacted',
						userIds: ['1', '2', '3'],
						userTime: ['13:57', '1:30', '23:37'],
					},
				],
			},
		];

		// Mount the component with the relevant events
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				votesByOption: [],
				event: {
					content: {
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [
							{ id: 1, date: date },
							{ id: 2, date: date },
						],
						type: 'scheduler',
					},
					event_id: 'TEST',
				},
			},
		});

		// Set the votesByOption field of the mocked component (cant do this when mounting)
		wrapper.vm.votesByOption = votesByOption;

		// Call the function
		const get_sorted_votes_for_schedulerSpy = vi.spyOn(wrapper.vm, 'get_sorted_votes_for_scheduler');

		// Check if the sort happened correctly
		expect(wrapper.vm.get_sorted_votes_for_scheduler()[0]).toEqual(2);
		expect(get_sorted_votes_for_schedulerSpy).toHaveBeenCalled();
	});

	test('updateVotingWidgetWithEvent correctly updates the votingWidget for poll RADIO type', () => {
		// Use date of the system to test functions
		const date = new Date();
		// Mount the component with the relevant events
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				event: {
					content: {
						voting_type: 'radio',
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [
							{ id: 1, date: date },
							{ id: 2, date: date },
						],
						type: 'poll',
					},
					event_id: 'TEST',
				},
			},
		});
		const replyEventRadioHasNotVoted = {
			sender: 'TEST',
			content: {
				msgtype: 'pubhubs.voting_widget.vote',
				'm.relates_to': {
					event_id: 'TEST',
					rel_type: 'TEST',
				},
				optionId: 1,
				vote: 'yes',
			},
		};
		const replyEventRadioHasVoted = {
			sender: 'TEST',
			content: {
				msgtype: 'pubhubs.voting_widget.vote',
				'm.relates_to': {
					event_id: 'TEST',
					rel_type: 'TEST',
				},
				optionId: 2,
				vote: 'yes',
			},
		};
		// Send the first event and check if 'votesByOption' has been edited correctly
		wrapper.vm.updateVotingWidgetWithEvent(replyEventRadioHasNotVoted);
		expect(wrapper.vm.votesByOption.options[0].votes[0].userIds[0]).toBe('TEST');

		// Send the second event and check if 'votesByOption' has been edited correctly
		wrapper.vm.updateVotingWidgetWithEvent(replyEventRadioHasVoted);
		expect(wrapper.vm.votesByOption.options[1].votes[0].userIds[0]).toBe('TEST');
		expect(wrapper.vm.votesByOption.options[0].votes[0].userIds).toStrictEqual([]);
	});

	test('updateVotingWidgetWithEvent correctly updates the votingWidget for poll CHECKBOX type', () => {
		// Use date of the system to test functions
		const date = new Date();
		// Mount the component with the relevant events
		const wrapper = mount(VotingWidget, {
			global: { plugins: [i18n] },
			props: {
				event: {
					content: {
						voting_type: 'checkbox',
						msgtype: 'pubhubs.voting_widget.widget',
						body: 'TEST',
						title: 'TEST',
						description: 'TEST',
						location: 'TEST',
						options: [
							{ id: 1, date: date },
							{ id: 2, date: date },
						],
						type: 'poll',
					},
					event_id: 'TEST',
				},
			},
		});
		// Event when a user has not voted yet
		const replyEventCheckboxHasNotVoted = {
			sender: 'TEST',
			content: {
				msgtype: 'pubhubs.voting_widget.vote',
				'm.relates_to': {
					event_id: 'TEST',
					rel_type: 'TEST',
				},
				optionId: 1,
				vote: 'yes',
			},
		};
		// Event when a user has already voted
		const replyEventCheckboxHasVoted = {
			sender: 'TEST',
			content: {
				msgtype: 'pubhubs.voting_widget.vote',
				'm.relates_to': {
					event_id: 'TEST',
					rel_type: 'TEST',
				},
				optionId: 2,
				vote: 'yes',
			},
		};
		// Send the first event and check if 'votesByOption' has been edited correctly
		wrapper.vm.updateVotingWidgetWithEvent(replyEventCheckboxHasNotVoted);
		expect(wrapper.vm.votesByOption.options[0].votes[0].userIds[0]).toBe('TEST');

		// Send the second event and check if 'votesByOption' has been edited correctly
		wrapper.vm.updateVotingWidgetWithEvent(replyEventCheckboxHasVoted);
		expect(wrapper.vm.votesByOption.options[1].votes[0].userIds[0]).toBe('TEST');
	});
});

describe('Back end functions', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	test('addPoll', () => {
		const addPollSpy = vi.spyOn(usePubhubsStore(), 'addPoll');

		// Define a mock sendEvent function
		const sendEventMock = vi.fn();
		// Assign the mock sendEvent function to client
		usePubhubsStore().client.sendMessage = sendEventMock;

		const roomId = 'roomId';

		const poll = new Poll('Poll Test Title', 'Poll Test Description?', false, ['1', '2', '3']);

		usePubhubsStore().addPoll(roomId, poll);

		// Expect addPoll to be called with specific parameters
		expect(addPollSpy).toHaveBeenCalledWith(roomId, poll);
		// Expect sendEvent to be called with specific parameters
		expect(sendEventMock).toHaveBeenCalledWith(roomId, {
			msgtype: 'pubhubs.voting_widget.widget',
			body: poll.title,
			title: poll.title,
			description: poll.description,
			options: poll.options,
			type: poll.type,
			showVotesBeforeVoting: poll.showVotesBeforeVoting,
		});
	});

	test('addScheduler', () => {
		const addPollSpy = vi.spyOn(usePubhubsStore(), 'addScheduler');

		// Define a mock sendEvent function
		const sendEventMock = vi.fn();
		// Assign the mock sendEvent function to client
		usePubhubsStore().client.sendMessage = sendEventMock;

		const roomId = 'roomId';
		const scheduler = new Scheduler('Scheduler Test Title', 'Scheduler Test Description', 'Scheduler Test Location', ['1', '2', '3'], false, VotingWidgetType.SCHEDULER);

		usePubhubsStore().addScheduler(roomId, scheduler);

		// Expect addPoll to be called with specific parameters
		expect(addPollSpy).toHaveBeenCalledWith(roomId, scheduler);
		// Expect sendEvent to be called with specific parameters
		expect(sendEventMock).toHaveBeenCalledWith(roomId, {
			msgtype: 'pubhubs.voting_widget.widget',
			body: scheduler.title,
			title: scheduler.title,
			description: scheduler.description,
			location: scheduler.location,
			options: [], // Only expect options with status FILLED
			type: scheduler.type,
			showVotesBeforeVoting: scheduler.showVotesBeforeVoting,
		});
	});

	test('addVote', () => {
		const addVoteSpy = vi.spyOn(usePubhubsStore(), 'addVote');

		const sendEventMock = vi.fn();
		usePubhubsStore().client.sendEvent = sendEventMock;

		const roomId = 'roomId';
		const eventId = 'eventId';
		const optionId = 1;
		const vote = 'yes';

		usePubhubsStore().addVote(roomId, eventId, optionId, vote);

		expect(addVoteSpy).toHaveBeenCalledWith(roomId, eventId, optionId, vote);
		expect(sendEventMock).toHaveBeenCalledWith(roomId, 'pubhubs.voting_widget.reply', {
			msgtype: 'pubhubs.voting_widget.vote',
			optionId: optionId,
			vote: vote,
			'm.relates_to': {
				event_id: eventId,
				rel_type: 'pubhubs.voting_widget.vote',
			},
		});
	});
});

describe('interfaces', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	test('TVotingWidgetMessageEventContent Poll - Radio', () => {
		// Create a sample data object for Poll
		const data: TVotingWidgetMessageEventContent = {
			msgtype: 'pubhubs.voting_widget.widget',
			title: 'Test Title',
			description: 'Test Description',
			options: ['Option 1', 'Option 2'],
			type: VotingWidgetType.POLL,
		};

		// Expect the data object to match the interface structure
		expect(data).toEqual({
			msgtype: expect.any(String),
			title: expect.any(String),
			description: expect.any(String),
			options: expect.arrayContaining([expect.any(String)]),
			type: 'poll',
		});
	});

	test('TVotingWidgetMessageEventContent Poll - Checkbox', () => {
		// Create a sample data object for Poll
		const data: TVotingWidgetMessageEventContent = {
			msgtype: 'pubhubs.voting_widget.widget',
			title: 'Test Title',
			description: 'Test Description',
			options: ['Option 1', 'Option 2'],
			type: VotingWidgetType.POLL,
		};

		// Expect the data object to match the interface structure
		expect(data).toEqual({
			msgtype: expect.any(String),
			title: expect.any(String),
			description: expect.any(String),
			options: expect.arrayContaining([expect.any(String)]),
			type: 'poll',
		});
	});

	test('TVotingWidgetMessageEventContent Scheduler', () => {
		// Create a sample data object for Scheduler
		const data: TVotingWidgetMessageEventContent = {
			msgtype: 'pubhubs.voting_widget.widget',
			title: 'Test Title',
			description: 'Test Description',
			location: 'Test Location',
			options: ['Option 1', 'Option 2'],
			type: VotingWidgetType.SCHEDULER,
		};

		// Expect the data object to match the interface structure
		expect(data).toEqual({
			msgtype: expect.any(String),
			title: expect.any(String),
			description: expect.any(String),
			location: expect.any(String),
			options: expect.arrayContaining([expect.any(String)]),
			type: 'scheduler',
		});
	});

	test('M_PollMessageOptions', () => {
		// Create a sample data object
		const data: PollOption = {
			id: 1,
			title: 'Poll Option',
		};

		// Expect the data object to match the interface structure
		expect(data).toEqual({
			id: expect.any(Number),
			title: expect.any(String),
		});
	});

	test('M_SchedulerMessageOptions', () => {
		// Create a sample data object
		const data: SchedulerOption = {
			id: 1,
			startTime: new Date(),
			endTime: new Date(),
		};

		// Expect the data object to match the interface structure
		expect(data).toEqual({
			id: expect.any(Number),
			startTime: expect.any(Date),
			endTime: expect.any(Date),
		});
	});

	describe('enums', () => {
		beforeEach(() => {
			setActivePinia(createPinia());
		});

		afterEach(() => {
			vi.resetAllMocks();
		});

		test('VotingWidgetType', () => {
			expect(VotingWidgetType.POLL).toBe('poll');
			expect(VotingWidgetType.SCHEDULER).toBe('scheduler');
		});
	});
});
