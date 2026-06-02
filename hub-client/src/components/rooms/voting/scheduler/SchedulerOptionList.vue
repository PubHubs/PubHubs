<template>
	<div role="list">
		<SchedulerOptionItem
			v-for="option in visibleOptions"
			:key="option.id"
			:closed="closed"
			:event-id="eventId"
			:is-creator="isCreator"
			:option="option"
			:picked-option-id="pickedOptionId"
			:show-votes="showVotes"
			:show-votes-before-voting="showVotesBeforeVoting"
			:uservote="voteOfUserOnOption(option.id)"
			:votes="votesOfOption(option.id)"
			role="listitem"
			@pick-date="$emit('pickDate', $event)"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Components
	import SchedulerOptionItem from '@hub-client/components/rooms/voting/scheduler/SchedulerOptionItem.vue';

	// Models
	import { type SchedulerOption, type votesForOption } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps<{
		options: SchedulerOption[];
		votesByOption: votesForOption[];
		eventId: string;
		closed: boolean;
		isCreator: boolean;
		pickedOptionId: number;
		showVotesBeforeVoting: boolean | undefined;
		showVotes: boolean;
		sortBasedOnScore: boolean;
	}>();

	defineEmits<{
		(e: 'pickDate', optionId: number): void;
	}>();

	const sortedOptions = computed(() => {
		if (!props.sortBasedOnScore) {
			const clonedOptions = JSON.parse(JSON.stringify(props.options)) as SchedulerOption[];
			clonedOptions.sort((a, b) => {
				let dateA, dateB;
				if (typeof a.date === 'string') {
					dateA = new Date(a.date);
				} else {
					dateA = new Date(a.date[0]);
				}
				if (typeof b.date === 'string') {
					dateB = new Date(b.date);
				} else {
					dateB = new Date(b.date[0]);
				}
				return dateA.getTime() - dateB.getTime();
			});
			return clonedOptions;
		} else {
			return props.options;
		}
	});

	const visibleOptions = computed(() => {
		if (props.closed && props.pickedOptionId !== -1 && !props.showVotes) {
			return sortedOptions.value.filter((o) => o.id === props.pickedOptionId);
		}
		return sortedOptions.value;
	});

	const votesOfOption = (optionId: number) => props.votesByOption.find((vote) => vote.optionId === optionId)?.votes ?? [];

	const voteOfUserOnOption = (optionId: number) => {
		const user = useUser();
		return votesOfOption(optionId).find((vote) => vote.userVotes.some((uv) => uv.userId === (user.userId ?? '')))?.choice ?? '';
	};
</script>
