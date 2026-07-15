<template>
	<div
		class="bg-surface-background rounded-base border-surface-elevated relative z-0 mb-100 flex flex-col overflow-clip border-3"
		:class="[!showVotes && 'h-800', option.id === pickedOptionId && 'border-accent-green!']"
	>
		<div class="flex h-full min-h-600 items-center justify-between gap-200 px-200 py-100">
			<div class="flex items-end">
				{{ filters.getDateStr(option.date, is24HourFormat, d) }}
			</div>
			<div
				v-if="!closed"
				class="ml-auto flex items-center justify-end gap-100"
			>
				<OptionButton
					color="bg-accent-green text-on-accent-green"
					:colorwhen="uservote === 'yes'"
					:disabled="closed"
					@click="vote('yes')"
				>
					<Icon
						class="m-auto"
						size="sm"
						type="check"
					/>
				</OptionButton>
				<OptionButton
					color="bg-accent-orange text-on-accent-orange"
					:colorwhen="uservote === 'maybe'"
					:disabled="closed"
					@click="vote('maybe')"
				>
					<Icon
						class="m-auto"
						size="sm"
						type="tilde"
					/>
				</OptionButton>
				<OptionButton
					color="bg-accent-red text-on-accent-red"
					:colorwhen="uservote === 'no'"
					:disabled="closed"
					@click="vote('no')"
				>
					<Icon
						class="m-auto"
						size="sm"
						type="x"
					/>
				</OptionButton>
			</div>
			<div
				v-if="closedAndPicking"
				class="ml-auto justify-end"
			>
				<Button
					size="sm"
					@click="pickDate()"
					>{{ $t('message.pick') }}</Button
				>
			</div>
		</div>
		<div
			v-if="showVotes"
			class="bg-surface-background"
		>
			<ViewVotesSchedulerOption :votes="votes"></ViewVotesSchedulerOption>
		</div>
		<ProgressBarMulti
			v-if="!closed || showVotes"
			:percentages="[getPercentage('yes'), getPercentage('maybe'), getPercentage('no')]"
		></ProgressBarMulti>
	</div>
</template>
<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import OptionButton from '@hub-client/components/rooms/voting/scheduler/OptionButton.vue';
	import ViewVotesSchedulerOption from '@hub-client/components/rooms/voting/view-votes/ViewVotesSchedulerOption.vue';
	import ProgressBarMulti from '@hub-client/components/ui/ProgressBarMulti.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { type SchedulerOption, type vote as voteType } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { TimeFormat, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// Props
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

	const emit = defineEmits<{
		(e: 'pickDate', optionId: number): void;
	}>();

	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const settings = useSettings();
	const { d } = useI18n();
	const user = useUser();

	const closedAndPicking = computed(() => {
		return props.isCreator && props.closed && props.pickedOptionId === -1;
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
			p = (voteObject.userVotes.length / props.votes.reduce((acc, vote) => acc + vote.userVotes.length, 0)) * 100;
			if (isNaN(p)) p = 0;
		}
		return p;
	};

	const vote = (choice: string) => {
		const voteObject = getVoteObject(choice);
		if (voteObject) {
			if (voteObject.userVotes.some((uv) => uv.userId === user.user.userId)) {
				//  User has already voted on this specific choice
				pubhubs.addVote(rooms.currentRoomId, props.eventId, props.option.id, 'redacted');
			} else {
				pubhubs.addVote(rooms.currentRoomId, props.eventId, props.option.id, choice);
			}
		}
	};

	function pickDate() {
		pubhubs.pickOptionVotingWidget(rooms.currentRoomId, props.eventId, props.option.id);
		emit('pickDate', props.option.id);
	}
</script>
