<template>
	<div
		class="relative z-0 rounded-lg"
		:class="{
			'outline outline-2 outline-black': datePicked && pickedOptionId == props.option.id,
			'opacity-50': datePicked && pickedOptionId !== props.option.id,
		}"
	>
		<div class="align-items-center flex flex-wrap rounded-t-lg bg-background px-5 py-2 lg:justify-items-start">
			<div class="flex items-end">
				{{ filters.getDateStr(option.date, is24HourFormat, d) }}
			</div>
			<div v-if="!closedAndPicking" class="ml-auto flex items-center justify-end gap-2">
				<OptionButton color="bg-accent-lime" :colorwhen="uservote === 'yes'" :disabled="closed" @click="vote('yes')">
					<Icon class="ml-1" type="check-circle" size="xs" />
				</OptionButton>
				<OptionButton color="bg-accent-orange" :colorwhen="uservote === 'maybe'" :disabled="closed" @click="vote('maybe')">
					<div class="-mt-1 text-3xl">~</div>
				</OptionButton>
				<OptionButton color="bg-accent-red" :colorwhen="uservote === 'no'" :disabled="closed" @click="vote('no')">
					<Icon class="ml-1" type="x" size="xs" />
				</OptionButton>
			</div>
			<div v-if="closedAndPicking" class="ml-auto justify-end">
				<Button @click="pickDate()" size="sm">{{ $t('message.pick') }}</Button>
			</div>
		</div>
		<div v-if="showVotes" class="relative flex bg-surface-high px-5">
			<ViewVotesSchedulerOption :votes="votes"></ViewVotesSchedulerOption>
		</div>
		<ProgressBarMulti class="relative -z-10 -mt-2 mb-2" :percentages="[getPercentage('yes'), getPercentage('maybe'), getPercentage('no')]"></ProgressBarMulti>
	</div>
</template>
<script setup lang="ts">
	// components
	import Icon from '@/components/elements/Icon.vue';
	import OptionButton from './OptionButton.vue';

	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';
	import filters from '@/logic/core/filters';
	import { useUser } from '@/logic/store/user';
	import { useRooms } from '@/logic/store/rooms';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { TimeFormat, useSettings } from '@/logic/store/settings';
	import { vote as voteType, SchedulerOption } from '@/model/events/voting/VotingTypes';

	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const settings = useSettings();
	const { d } = useI18n();

	const props = defineProps<{
		option: SchedulerOption;
		votes: voteType[];
		uservote: string;
		eventId: string;
		closed: boolean;
		pickedOptionId: number;
		isCreator: boolean;
		showVotesBeforeVoting: boolean | undefined;
		showVotes: boolean;
	}>();

	const user = useUser();

	const closedAndPicking = computed(() => {
		return props.isCreator && props.closed && props.pickedOptionId === -1;
	});

	const datePicked = computed(() => {
		return props.pickedOptionId !== -1;
	});

	const is24HourFormat = computed(() => {
		return settings.timeformat === TimeFormat.format24;
	});

	const getVoteObject = (choice: string) => {
		return props.votes.find((vote) => vote.choice === choice);
	};

	const getPercentage = (choice: string) => {
		const voteObject = getVoteObject(choice);
		let p = 0;
		if (voteObject) {
			p = (voteObject.userIds.length / props.votes.reduce((acc, vote) => acc + vote.userIds.length, 0)) * 100;
			if (isNaN(p)) p = 0;
		}
		return p;
	};

	const vote = (choice: string) => {
		const voteObject = getVoteObject(choice);
		if (voteObject) {
			if (voteObject.userIds.includes(user.user.userId)) {
				//user has already voted on this specific choice
				pubhubs.addVote(rooms.currentRoomId, props.eventId, props.option.id, 'redacted');
			} else {
				pubhubs.addVote(rooms.currentRoomId, props.eventId, props.option.id, choice);
			}
		}
	};

	function pickDate() {
		pubhubs.pickOptionVotingWidget(rooms.currentRoomId, props.eventId, props.option.id);
	}
</script>
