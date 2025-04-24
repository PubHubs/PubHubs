<template>
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
	/>
</template>

<script setup lang="ts">
	import { useUser } from '@/logic/store/user';
	import SchedulerOptionItem from '@/components/rooms/voting/scheduler/SchedulerOptionItem.vue';
	import { SchedulerOption, votesForOption } from '@/model/events/voting/VotingTypes';
	import { computed } from 'vue';

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
		return votesOfOption(optionId).find((vote) => vote.userIds.includes(user.user.userId))?.choice ?? '';
	};
</script>
