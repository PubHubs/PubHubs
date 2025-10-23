<template>
	<div role="list">
		<SchedulerOptionItem
			v-for="option in sortedOptions"
			:key="option.id"
			:option="option"
			:votes="votesOfOption(option.id)"
			:uservote="voteOfUserOnOption(option.id)"
			:eventId="eventId"
			:closed="closed"
			:pickedOptionId="pickedOptionId"
			:isCreator="isCreator"
			:showVotesBeforeVoting="showVotesBeforeVoting"
			:showVotes="showVotes"
			role="listitem"
		/>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import SchedulerOptionItem from '@hub-client/components/rooms/voting/scheduler/SchedulerOptionItem.vue';

	// Models
	import { SchedulerOption, votesForOption } from '@hub-client/models/events/voting/VotingTypes';

	// Users
	import { useUser } from '@hub-client/stores/user';

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

	const votesOfOption = (optionId: number) => props.votesByOption.find((vote) => vote.optionId === optionId)?.votes ?? [];

	const voteOfUserOnOption = (optionId: number) => {
		const user = useUser();
		return votesOfOption(optionId).find((vote) => vote.userIds.includes(user.userId))?.choice ?? '';
	};
</script>
