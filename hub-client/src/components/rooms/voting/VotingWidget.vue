<template>
	<div
		class="bg-surface-base border-surface-elevated rounded-base border-3 p-200"
		:class="isMobile ? 'w-full' : 'w-5/6'"
		@contextmenu.prevent="openMenu($event, getContextMenuItems(), null, true)"
		@touchstart.stop
	>
		<div class="mb-200 flex flex-col gap-100">
			<div class="flex flex-wrap items-center justify-between gap-100">
				<div class="flex flex-wrap items-center gap-100 wrap-anywhere">
					<Icon
						v-if="votingWidgetClosed"
						class="text-accent-orange"
						size="sm"
						type="lock"
					/>
					<span class="mr-1 font-bold">{{ votingWidget.title }}</span>
					<span
						v-if="isEdited"
						class="text-on-surface-dim flex"
					>
						({{ $t('message.voting.edited') }})
					</span>
					<span
						v-if="votingWidgetClosed"
						class="text-label-small italic"
						>{{ $t('message.scheduler_closed') }}
					</span>
				</div>
				<button
					v-if="!isMobile"
					class="text-on-surface-dim hover:bg-accent-primary hover:text-on-accent-primary ml-2 flex items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
					:title="$t('message.context_menu')"
					@click.stop="openMenu($event, getContextMenuItems(), null, true)"
				>
					<Icon type="dots-three-vertical" />
				</button>
			</div>

			<span
				v-if="votingWidget.location"
				class="flex items-center gap-100 wrap-anywhere"
			>
				<Icon
					size="sm"
					type="map-pin"
				/>
				{{ votingWidget.location }}
			</span>
			<span class="flex wrap-anywhere">{{ votingWidget.description }}</span>
		</div>

		<PollOptionList
			v-if="votingWidget.type === VotingWidgetType.POLL"
			:closed="votingWidgetClosed"
			:event-id="event.event_id"
			:has-user-voted="hasUserVoted"
			:options="votingWidget.options as PollOption[]"
			:show-votes="showVotes"
			:show-votes-before-voting="votingWidget.showVotesBeforeVoting"
			:votes-by-option="votesByOption.options"
		/>
		<SchedulerOptionList
			v-if="votingWidget.type === VotingWidgetType.SCHEDULER"
			:closed="votingWidgetClosed"
			:event-id="event.event_id"
			:is-creator="isCreator"
			:options="votingWidget.options as SchedulerOption[]"
			:picked-option-id="pickedOptionId"
			:show-votes="showVotes"
			:show-votes-before-voting="votingWidget.showVotesBeforeVoting"
			:sort-based-on-score="votingWidgetClosed && isCreator"
			:votes-by-option="votesByOption.options"
			@pick-date="onPickDate($event)"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type MatrixEvent } from 'matrix-js-sdk';
	import { type Ref, computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import PollOptionList from '@hub-client/components/rooms/voting/poll/PollOptionList.vue';
	import SchedulerOptionList from '@hub-client/components/rooms/voting/scheduler/SchedulerOptionList.vue';

	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';

	import { ContextVariant, type MenuItem } from '@hub-client/models/components/contextMenu.models';
	// Models
	import { type TBaseEvent } from '@hub-client/models/events/TBaseEvent';
	import { type TVotingMessageEvent } from '@hub-client/models/events/voting/TVotingMessageEvent';
	import {
		Poll,
		type PollOption,
		Scheduler,
		type SchedulerOption,
		VotingOptions,
		type VotingWidget,
		VotingWidgetType,
		type votesForOption,
	} from '@hub-client/models/events/voting/VotingTypes';
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { TimeFormat, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type VotingReplyContent = {
		msgtype?: string;
		title?: string;
		description?: string;
		location?: string;
		voting_type?: VotingWidgetType;
		showVotesBeforeVoting?: boolean;
		options?: PollOption[] | SchedulerOption[];
		'm.relates_to'?: { event_id?: string };
		optionId?: number;
		vote?: string;
	};

	// Props
	const props = withDefaults(
		defineProps<{
			room: Room;
			event: TVotingMessageEvent;
		}>(),
		{},
	);

	const emit = defineEmits<{
		(e: 'editPoll', poll: Poll, eventId: string): void;
		(e: 'editScheduler', scheduler: Scheduler, eventId: string): void;
	}>();

	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const settings = useSettings();
	const { d, t } = useI18n();
	const isMobile = computed(() => settings.isMobileState);
	const isCreator = user.userId === props.event.sender;
	const { openMenu } = useContextMenu();

	const getContextMenuItems = (): MenuItem[] => {
		const items: MenuItem[] = [];
		if (hasUserVoted.value) {
			items.push({
				label: t(showVotes.value ? 'message.voting.hide_votes' : 'message.voting.show_votes'),
				icon: showVotes.value ? 'eye-slash' : 'eye',
				onClick: () => toggleShowVotes(),
			});
		}
		if (isCreator && !votingWidgetClosed.value) {
			items.push({ label: t('message.edit'), icon: 'pencil-simple', onClick: () => editWidget() });
		}
		if (isCreator) {
			if (votingWidgetClosed.value) {
				items.push({ label: t('message.reopen'), icon: 'lock-open', onClick: () => reopenWidget() });
			} else {
				items.push({ label: t('message.close'), icon: 'lock', onClick: () => closeWidget(), variant: ContextVariant.delicate });
			}
		}
		return items;
	};

	const isEdited = ref(false);
	const showVotes = ref(false);
	const votesByOption = ref(new VotingOptions());
	const hasUserVoted = ref<boolean>(false);
	const votingWidget = ref<VotingWidget>(new Poll());
	let lastEventTimestamp: number;
	const processedEventIds = new Set<string>();

	const is24HourFormat = computed(() => {
		return settings.timeformat === TimeFormat.format24;
	});

	// Lifecycle
	watch(
		() => votesByOption.value.options,
		() => {
			hasUserVoted.value = votesByOption.value.options.some((vote) =>
				vote.votes.some((v) => v.userVotes.some((uv) => uv.userId === (user.userId ?? ''))),
			);
		},
	);

	onMounted(() => {
		votesByOption.value.options = initializeVotesByOption(votingWidget.value.options);
		collectVotes();
	});

	watch(
		() => props.room.filterRoomWidgetRelatedEvents(props.event.content.type, props.event.event_id),
		(event) => {
			collectNewVotes(event);
		},
	);

	if (props.event.content.type === VotingWidgetType.POLL) {
		votingWidget.value = new Poll(
			props.event.content.title,
			props.event.content.description,
			props.event.content.showVotesBeforeVoting,
			props.event.content.options as PollOption[],
		);
	} else if (props.event.content.type === VotingWidgetType.SCHEDULER) {
		votingWidget.value = new Scheduler(
			props.event.content.title,
			props.event.content.description,
			props.event.content.location,
			props.event.content.showVotesBeforeVoting,
			props.event.content.options as SchedulerOption[],
		);
	}

	votingWidget.value.removeExcessOptions();

	const votingWidgetClosed = ref(false);

	const pickedOptionId: Ref<number> = ref(-1);

	function createEmptyVotesForOption(option: PollOption | SchedulerOption, type: string) {
		const votesForOption: votesForOption = { optionId: option.id, votes: [] };
		if (type === VotingWidgetType.SCHEDULER) {
			votesForOption.votes = [
				{ choice: 'yes', userVotes: [] },
				{ choice: 'maybe', userVotes: [] },
				{ choice: 'no', userVotes: [] },
				{ choice: 'redacted', userVotes: [] },
			];
		} else {
			votesForOption.votes = [
				{ choice: 'yes', userVotes: [] },
				{ choice: 'redacted', userVotes: [] },
			];
		}
		return votesForOption;
	}

	// Returns an empty 'votesForOption' array
	function initializeVotesByOption(options: SchedulerOption[] | PollOption[]) {
		let newVotesByOption: votesForOption[];
		newVotesByOption = [];
		for (const option of options) {
			const votesForOption: votesForOption = createEmptyVotesForOption(option, votingWidget.value.type);
			newVotesByOption.push(votesForOption);
		}
		return newVotesByOption;
	}

	// Modify a voting widget with a modify event sent by it's creator
	function modifyVotingWidgetWithEvent(replyEvent: TBaseEvent) {
		const reply_content = replyEvent.content as VotingReplyContent;
		switch (reply_content.msgtype) {
			case PubHubsMgType.VotingWidgetClose:
				votingWidgetClosed.value = true;
				break;
			case PubHubsMgType.VotingWidgetOpen:
				votingWidgetClosed.value = false;
				break;
			case PubHubsMgType.VotingWidgetEdit:
				{
					isEdited.value = true;

					if (reply_content.title) {
						votingWidget.value.title = reply_content.title;
					}
					if (reply_content.description) {
						votingWidget.value.description = reply_content.description;
					}
					if (reply_content.location) {
						votingWidget.value.location = reply_content.location;
					}
					if (reply_content.voting_type) {
						votingWidget.value.type = reply_content.voting_type;
					}
					votingWidget.value.showVotesBeforeVoting = !!reply_content.showVotesBeforeVoting;

					const newVotesByOption = initializeVotesByOption(reply_content.options ?? []);

					if (reply_content.options) {
						for (let i = 0; i < reply_content.options.length; i++) {
							if (votingWidget.value.type === VotingWidgetType.POLL) {
								if ((reply_content.options[i] as PollOption).title === '') {
									reply_content.options.splice(i--, 1);
								}
							} else if (votingWidget.value.type === VotingWidgetType.SCHEDULER) {
								if ((reply_content.options[i] as SchedulerOption).date.length === 0) {
									reply_content.options.splice(i--, 1);
								}
							}
						}
					}

					if (reply_content.options) {
						const new_options: PollOption[] | SchedulerOption[] = reply_content.options;
						const old_options: PollOption[] | SchedulerOption[] = votingWidget.value.options;
						//remove old options and carry over votes for unchanged options
						for (const old_option of old_options) {
							//I could not get the findIndex() method to work, so we are finding the matching index the old fashioned way. Same thing further below.
							let index_in_new_options = -1;
							for (let i = 0; i < new_options.length; i++) {
								if (votingWidget.value.type === VotingWidgetType.POLL) {
									const new_option = new_options[i] as PollOption;
									const old_option_poll = old_option as PollOption;
									if (new_option.title === old_option_poll.title) {
										index_in_new_options = i;
										break;
									}
								} else if (votingWidget.value.type === VotingWidgetType.SCHEDULER) {
									const new_option = new_options[i] as SchedulerOption;
									const old_option_sched = old_option as SchedulerOption;
									if (
										filters.getDateStr(new_option.date, is24HourFormat.value, d) ===
										filters.getDateStr(old_option_sched.date, is24HourFormat.value, d)
									) {
										index_in_new_options = i;
										break;
									}
								}
							}

							//if option still exists, copy over votes
							if (index_in_new_options !== -1) {
								let votes_old_option_index = -1;
								for (let i = 0; i < votesByOption.value.options.length; i++) {
									if (votesByOption.value.options[i].optionId === old_option.id) {
										votes_old_option_index = i;
										break;
									}
								}

								let new_index = -1;
								for (let i = 0; i < newVotesByOption.length; i++) {
									if (newVotesByOption[i].optionId === new_options[index_in_new_options].id) {
										new_index = i;
										break;
									}
								}

								if (new_index >= 0) {
									newVotesByOption[new_index].votes = [...votesByOption.value.options[votes_old_option_index].votes];
								}
							}
						}
					}

					if (reply_content.options) {
						votingWidget.value.options = reply_content.options;
						votesByOption.value.newVotes(newVotesByOption);
					}

					votingWidget.value.removeExcessOptions();
				}
				break;
		}
	}

	//must be called in chronological timeline order for each event, so old events before new ones.
	function updateVotingWidgetWithEvent(replyEvent: TBaseEvent) {
		const reply_content = replyEvent.content as VotingReplyContent;
		//check wether 'replyEvent' is in response to this event
		if (reply_content?.['m.relates_to']?.event_id !== props.event.event_id) {
			return;
		}

		if (replyEvent.type === PubHubsMgType.VotingWidgetModify) {
			modifyVotingWidgetWithEvent(replyEvent);
		}

		if (replyEvent.type === PubHubsMgType.VotingWidgetPickOption && reply_content.optionId !== undefined && reply_content.optionId >= 0) {
			pickedOptionId.value = reply_content.optionId;
		}

		//ignore votes when closed and ignore non vote events from here
		if (votingWidgetClosed.value || reply_content.msgtype !== PubHubsMgType.VotingWidgetVote) {
			return;
		}

		//the poll is open and the event is a vote, add the vote

		const reply_vote = reply_content?.vote;
		const reply_option = reply_content?.optionId;
		const reply_user = replyEvent.sender;

		const date = new Date(replyEvent.origin_server_ts);
		const reply_time = date.toLocaleString();

		const correspondingOption = votesByOption.value.options.find((option) => option.optionId === reply_option);
		if (reply_user && correspondingOption) {
			let userVoteAlreadyRegistered = false;
			let alreadyRegisteredUserIndex = -1;
			let alreadyRegisteredUserChoices;
			if (votingWidget.value.type === VotingWidgetType.POLL) {
				//need to check each option here, since the user can only vote one option on a radio poll
				for (const option of votesByOption.value.options) {
					for (const userChoices of option.votes) {
						alreadyRegisteredUserIndex = userChoices.userVotes.findIndex((uv) => uv.userId === reply_user);
						if (alreadyRegisteredUserIndex >= 0) {
							userVoteAlreadyRegistered = true;
							alreadyRegisteredUserChoices = userChoices;
							break;
						}
					}
					if (alreadyRegisteredUserIndex >= 0) {
						break;
					}
				}
			} else {
				for (const userChoices of correspondingOption.votes) {
					alreadyRegisteredUserIndex = userChoices.userVotes.findIndex((uv) => uv.userId === reply_user);
					if (alreadyRegisteredUserIndex >= 0) {
						userVoteAlreadyRegistered = true;
						alreadyRegisteredUserChoices = userChoices;
						break;
					}
				}
			}

			if (userVoteAlreadyRegistered) {
				//remove the old vote
				alreadyRegisteredUserChoices?.userVotes.splice(alreadyRegisteredUserIndex, 1);
			}
			//add the vote
			correspondingOption.votes.find((vote) => vote.choice === reply_vote)?.userVotes.push({ userId: reply_user, time: reply_time });

			if (replyEvent.origin_server_ts > lastEventTimestamp) {
				lastEventTimestamp = replyEvent.origin_server_ts;
			}

			//check if the user has voted but don't count redacted votes
			hasUserVoted.value = votesByOption.value.options.some((vote) =>
				vote.votes.some((v) => v.userVotes.some((uv) => uv.userId === (user.userId ?? '')) && v.choice !== 'redacted'),
			);
		}
	}

	//fully reset votes
	function collectVotes() {
		//events do not get registered instantly which leads to errors when creating polls
		//this check makes sure that the votingwidget event exists
		if (props.event.unsigned) {
			const events = props.room.filterRoomWidgetRelatedEvents(props.event.content.type, props.event.event_id);
			votesByOption.value.options = initializeVotesByOption(votingWidget.value.options); //clear any stored data in votesByOption
			processedEventIds.clear();
			events?.forEach((event) => {
				const id = event.event.event_id;
				if (id) processedEventIds.add(id);
				lastEventTimestamp = event.event.origin_server_ts as number;
				updateVotingWidgetWithEvent(event.event as unknown as TBaseEvent);
			});
			votesByOption.value.removeRedactedVotes();
		}
	}

	function collectNewVotes(events: MatrixEvent[]) {
		events.forEach((event) => {
			const id = event.event.event_id;
			if (!id || processedEventIds.has(id)) return;
			processedEventIds.add(id);
			updateVotingWidgetWithEvent(event.event as unknown as TBaseEvent);
		});
		votesByOption.value.removeRedactedVotes();
	}

	function get_user_ids() {
		let user_ids: string[] = [];
		for (const option of votesByOption.value.options) {
			for (const userChoices of option.votes) {
				if (userChoices.choice === 'redacted') {
					continue;
				}
				user_ids = [...new Set([...user_ids, ...userChoices.userVotes.map((uv) => uv.userId)])];
			}
		}
		return user_ids;
	}

	function onPickDate(optionId: number) {
		pickedOptionId.value = optionId;
		showVotes.value = false;
	}

	function closeWidget() {
		votingWidgetClosed.value = true;
		if (votingWidget.value.type === VotingWidgetType.SCHEDULER) {
			showVotes.value = true;
		}
		pickedOptionId.value = -1;
		pubhubs.closeVotingWidget(rooms.currentRoomId, props.event.event_id, get_user_ids());
	}

	function reopenWidget() {
		votingWidgetClosed.value = false;
		pickedOptionId.value = -1;
		pubhubs.reopenVotingWidget(rooms.currentRoomId, props.event.event_id, get_user_ids());
		pubhubs.pickOptionVotingWidget(rooms.currentRoomId, props.event.event_id, -1);
	}

	const editWidget = () => {
		//create a new widget to avoid reference issues
		if (votingWidget.value.type === VotingWidgetType.POLL) {
			const poll = new Poll(votingWidget.value.title, votingWidget.value.description, votingWidget.value.showVotesBeforeVoting);
			poll.addDeepCopyOfPollOptions(votingWidget.value.options as PollOption[]);
			poll.updateOptionsId();
			emit('editPoll', poll, props.event.event_id);
		} else if (votingWidget.value.type === VotingWidgetType.SCHEDULER) {
			const scheduler = new Scheduler(
				votingWidget.value.title,
				votingWidget.value.description,
				votingWidget.value.location,
				votingWidget.value.showVotesBeforeVoting,
			);
			scheduler.addDeepCopyOfSchedulerOptions(votingWidget.value.options as SchedulerOption[]);
			scheduler.updateOptionsId();
			emit('editScheduler', scheduler, props.event.event_id);
		}
	};

	function toggleShowVotes() {
		showVotes.value = !showVotes.value;
	}
</script>
