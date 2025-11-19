<template>
	<div class="w-5/6 rounded-lg bg-surface-subtle p-5">
		<div class="mb-4">
			<div class="flex justify-between">
				<div class="mb-2">
					<Icon v-if="votingWidgetClosed" class="float-left -mt-1 mr-1 text-accent-orange" type="lock" />
					<span class="mr-1 font-bold">{{ votingWidget.title }}</span>
					<span v-if="votingWidgetClosed" class="italic text-label-small"><br />{{ $t('message.scheduler_closed') }}</span>
				</div>

				<div class="flex">
					<Icon
						v-if="hasUserVoted"
						type="user"
						size="lg"
						class="rounded-md bg-surface hover:bg-accent-primary"
						:title="$t(showVotes ? 'message.voting.hide_votes' : 'message.voting.show_votes')"
						@click.stop="toggleShowVotes()"
					></Icon>
					<ActionMenu v-if="isCreator" class="ml-2">
						<template v-if="votingWidget.type === VotingWidgetType.SCHEDULER">
							<ActionMenuItem v-if="votingWidgetClosed == false" @click="closeWidget">
								{{ $t('message.close') }}
							</ActionMenuItem>
							<ActionMenuItem v-else @click="reopenWidget">
								{{ $t('message.reopen') }}
							</ActionMenuItem>
						</template>
						<ActionMenuItem v-if="votingWidgetClosed == false" @click="editWidget">{{ $t('message.edit') }}</ActionMenuItem>
					</ActionMenu>
				</div>
			</div>

			<span class="flex [overflow-wrap:anywhere]" v-if="votingWidget.location">
				<Icon class="mr-1 mt-1" type="map-pin" size="sm" />
				{{ votingWidget.location }}
			</span>
			<span class="mt-2 flex [overflow-wrap:anywhere]">{{ votingWidget.description }}</span>
			<span class="flex text-on-surface-variant" v-if="isEdited"> ({{ $t('message.voting.edited') }}) </span>
			<div v-if="isCreator && votingWidgetClosed && pickedOptionId === -1" class="flex justify-center">
				<div class="flex items-center rounded-md bg-background px-2 py-1">
					<div class="mr-2 h-5 w-5 rounded-full bg-accent-orange text-center">!</div>
					<span>{{ $t('message.pick_option') }} :</span>
				</div>
			</div>
		</div>

		<PollOptionList
			v-if="votingWidget.type === VotingWidgetType.POLL"
			:options="votingWidget.options as PollOption[]"
			:votesByOption="votesByOption.options"
			:eventId="event.event_id"
			:hasUserVoted="hasUserVoted"
			:showVotesBeforeVoting="votingWidget.showVotesBeforeVoting"
			:showVotes="showVotes"
		/>
		<SchedulerOptionList
			v-if="votingWidget.type === VotingWidgetType.SCHEDULER"
			:options="votingWidget.options as SchedulerOption[]"
			:votesByOption="votesByOption.options"
			:closed="votingWidgetClosed"
			:isCreator="isCreator"
			:eventId="event.event_id"
			:pickedOptionId="pickedOptionId"
			:showVotesBeforeVoting="votingWidget.showVotesBeforeVoting"
			:showVotes="showVotes"
			:sortBasedOnScore="votingWidgetClosed && isCreator"
		/>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { MatrixEvent } from 'matrix-js-sdk';
	import { Ref, computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import PollOptionList from '@hub-client/components/rooms/voting/poll/PollOptionList.vue';
	import SchedulerOptionList from '@hub-client/components/rooms/voting/scheduler/SchedulerOptionList.vue';
	import ActionMenu from '@hub-client/components/ui/ActionMenu.vue';
	import ActionMenuItem from '@hub-client/components/ui/ActionMenuItem.vue';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { TBaseEvent } from '@hub-client/models/events/TBaseEvent';
	import { TVotingMessageEvent } from '@hub-client/models/events/voting/TVotingMessageEvent';
	import { Poll, PollOption, Scheduler, SchedulerOption, VotingOptions, VotingWidget, VotingWidgetType, votesForOption } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { TimeFormat, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const rooms = useRooms();
	const currentRoom = rooms.currentRoom;
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const settings = useSettings();
	const { d } = useI18n();

	const props = defineProps<{ event: TVotingMessageEvent }>();

	const emit = defineEmits<{
		(e: 'editPoll', poll: Poll, eventId: string): void;
		(e: 'editScheduler', scheduler: Scheduler, eventId: string): void;
	}>();

	let lastEventTimestamp: number;
	const isCreator = user.userId == props.event.sender;

	const isEdited = ref(false);
	const showVotes = ref(false);
	const votesByOption = ref(new VotingOptions());
	const hasUserVoted = ref<boolean>(false);
	const votingWidget = ref<VotingWidget>(new Poll());
	if (props.event.content.type === VotingWidgetType.POLL) {
		votingWidget.value = new Poll(props.event.content.title, props.event.content.description, props.event.content.showVotesBeforeVoting, props.event.content.options as PollOption[]);
	} else if (props.event.content.type === VotingWidgetType.SCHEDULER) {
		votingWidget.value = new Scheduler(props.event.content.title, props.event.content.description, props.event.content.location, props.event.content.showVotesBeforeVoting, props.event.content.options as SchedulerOption[]);
	}

	watch(
		() => votesByOption.value.options,
		() => {
			hasUserVoted.value = votesByOption.value.options.some((vote) => vote.votes.some((v) => v.userIds.includes(user.userId)));
		},
	);

	onMounted(() => {
		votesByOption.value.options = initializeVotesByOption(votingWidget.value.options);
		collectVotes();
	});

	const is24HourFormat = computed(() => {
		return settings.timeformat === TimeFormat.format24;
	});

	watch(
		() => currentRoom?.filterRoomWidgetRelatedEvents(props.event.event_id),
		(event) => {
			collectNewVotes(event);
		},
	);

	votingWidget.value.removeExcessOptions();

	const votingWidgetClosed = ref(false);

	const pickedOptionId: Ref<number> = ref(-1);

	function createEmptyVotesForOption(option: PollOption | SchedulerOption, type: string) {
		const votesForOption: votesForOption = { optionId: option.id, votes: [] };
		if (type === VotingWidgetType.SCHEDULER) {
			votesForOption.votes = [
				{ choice: 'yes', userIds: [], userTime: [] },
				{ choice: 'maybe', userIds: [], userTime: [] },
				{ choice: 'no', userIds: [], userTime: [] },
				{ choice: 'redacted', userIds: [], userTime: [] },
			];
		} else {
			votesForOption.votes = [
				{ choice: 'yes', userIds: [], userTime: [] },
				{ choice: 'redacted', userIds: [], userTime: [] },
			];
		}
		return votesForOption;
	}

	//returns an empty 'votesForOption' array
	function initializeVotesByOption(options: SchedulerOption[] | PollOption[]) {
		let newVotesByOption: votesForOption[];
		newVotesByOption = [];
		for (const option of options) {
			const votesForOption: votesForOption = createEmptyVotesForOption(option, votingWidget.value.type);
			newVotesByOption.push(votesForOption);
		}
		return newVotesByOption;
	}

	function sort_score(v: votesForOption) {
		let score = 0.0;
		for (const userChoices of v.votes) {
			if (userChoices.choice == 'redacted') {
				continue;
			}
			if (userChoices.choice == 'yes') {
				score += 1.0 * userChoices.userIds.length;
			}
			if (userChoices.choice == 'maybe') {
				score += 0.5 * userChoices.userIds.length;
			}
		}
		return score;
	}

	function get_sorted_votes_for_scheduler() {
		let res = [...votesByOption.value.options];
		res.sort((v1, v2) => {
			let s1 = sort_score(v1);
			let s2 = sort_score(v2);
			if (s1 < s2) {
				return 1;
			}
			if (s1 > s2) {
				return -1;
			}
			return 0;
		});
		return res.map((x) => x.optionId);
	}

	//modify a voting widget with a modify event sent by it's creator
	function modifyVotingWidgetWithEvent(replyEvent: TBaseEvent) {
		const reply_content = replyEvent.content;
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

					const newVotesByOption = initializeVotesByOption(reply_content.options);

					for (let i = 0; i < reply_content.options.length; i++) {
						if (votingWidget.value.type === VotingWidgetType.POLL) {
							if (reply_content.options[i].title == '') {
								reply_content.options.splice(i--, 1);
							}
						} else if (votingWidget.value.type === VotingWidgetType.SCHEDULER) {
							if (reply_content.options[i].date == '') {
								reply_content.options.splice(i--, 1);
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
									if (new_option.title == old_option_poll.title) {
										index_in_new_options = i;
										break;
									}
								} else if (votingWidget.value.type === VotingWidgetType.SCHEDULER) {
									const new_option = new_options[i] as SchedulerOption;
									const old_option_sched = old_option as SchedulerOption;
									if (filters.getDateStr(new_option.date, is24HourFormat.value, d) == filters.getDateStr(old_option_sched.date, is24HourFormat.value, d)) {
										index_in_new_options = i;
										break;
									}
								}
							}

							//if option still exists, copy over votes
							if (index_in_new_options != -1) {
								let votes_old_option_index = -1;
								for (let i = 0; i < votesByOption.value.options.length; i++) {
									if (votesByOption.value.options[i].optionId == old_option.id) {
										votes_old_option_index = i;
										break;
									}
								}

								let new_index = -1;
								for (let i = 0; i < newVotesByOption.length; i++) {
									if (newVotesByOption[i].optionId == new_options[index_in_new_options].id) {
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
		const reply_content = replyEvent.content;
		//check wether 'replyEvent' is in response to this event
		if (reply_content?.['m.relates_to']?.event_id !== props.event.event_id) {
			return;
		}

		if (replyEvent.type == PubHubsMgType.VotingWidgetModify) {
			modifyVotingWidgetWithEvent(replyEvent);
		}

		if (replyEvent.type == PubHubsMgType.VotingWidgetPickOption) {
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
						alreadyRegisteredUserIndex = userChoices.userIds.indexOf(reply_user);
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
					alreadyRegisteredUserIndex = userChoices.userIds.indexOf(reply_user);
					if (alreadyRegisteredUserIndex >= 0) {
						userVoteAlreadyRegistered = true;
						alreadyRegisteredUserChoices = userChoices;
						break;
					}
				}
			}

			if (userVoteAlreadyRegistered) {
				//remove the old vote
				alreadyRegisteredUserChoices?.userIds.splice(alreadyRegisteredUserIndex, 1);
				alreadyRegisteredUserChoices?.userTime!.splice(alreadyRegisteredUserIndex, 1);
			}
			//add the vote
			correspondingOption.votes.find((vote) => vote.choice === reply_vote)?.userIds.push(reply_user);
			correspondingOption.votes.find((vote) => vote.choice === reply_vote)?.userTime!.push([reply_user, reply_time]);

			if (replyEvent.origin_server_ts > lastEventTimestamp) {
				lastEventTimestamp = replyEvent.origin_server_ts;
			}

			//check if the user has voted but don't count redacted votes
			hasUserVoted.value = votesByOption.value.options.some((vote) => vote.votes.some((v) => v.userIds.includes(user.userId) && v.choice !== 'redacted'));
		}
	}

	//fully reset votes
	function collectVotes() {
		//events do not get registered instantly which leads to errors when creating polls
		//this check makes sure that the votingwidget event exists
		if (props.event.unsigned) {
			//const events = currentRoom?.getRelatedLiveTimeEvents(props.event.event_id);
			//const events = currentRoom?.getRelatedEvents(props.event.event_id);
			const events = currentRoom?.filterRoomWidgetRelatedEvents(props.event.event_id);
			votesByOption.value.options = initializeVotesByOption(votingWidget.value.options); //clear any stored data in votesByOption
			events?.forEach((event) => {
				lastEventTimestamp = event.event.origin_server_ts as number;
				updateVotingWidgetWithEvent(event.event as TBaseEvent);
			});
			votesByOption.value.removeRedactedVotes();
		}
	}

	function collectNewVotes(events: MatrixEvent[]) {
		events.forEach((event) => {
			updateVotingWidgetWithEvent(event.event);
		});
		votesByOption.value.removeRedactedVotes();
	}

	function get_user_ids() {
		let user_ids: string[] = [];
		for (const option of votesByOption.value.options) {
			for (const userChoices of option.votes) {
				if (userChoices.choice == 'redacted') {
					continue;
				}
				user_ids = [...new Set([...user_ids, ...userChoices.userIds])];
			}
		}
		return user_ids;
	}

	function closeWidget() {
		const sortedOptionIds = get_sorted_votes_for_scheduler();
		votingWidget.value.options = sortedOptionIds
			.map((optionId) => {
				return votingWidget.value.options.find((option) => option.id === optionId);
			})
			.filter((option) => option !== undefined) as PollOption[] | SchedulerOption[];
		pubhubs.closeVotingWidget(rooms.currentRoomId, props.event.event_id, get_user_ids());
	}

	function reopenWidget() {
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
			const scheduler = new Scheduler(votingWidget.value.title, votingWidget.value.description, votingWidget.value.location, votingWidget.value.showVotesBeforeVoting);
			scheduler.addDeepCopyOfSchedulerOptions(votingWidget.value.options as SchedulerOption[]);
			scheduler.updateOptionsId();
			emit('editScheduler', scheduler, props.event.event_id);
		}
	};

	function toggleShowVotes() {
		showVotes.value = !showVotes.value;
	}
</script>
