<template>
	<ViewVotesSchedulerOption v-for="option in options" :key="option.id" :option="option" :votes="votesOfOption(option.id)" :hideTime="false"></ViewVotesSchedulerOption>
</template>

<script setup lang="ts">
	import ViewVotesSchedulerOption from '@/components/rooms/voting/view-votes/ViewVotesSchedulerOption.vue';

	import { SchedulerOption } from '@/model/events/voting/VotingTypes';

	const props = defineProps<{
		options: SchedulerOption[];
		votesByOption: {
			optionId: number;
			votes: {
				userTime: {
					id: string;
					time: string;
				}[];
				choice: string;
			}[];
		}[];
		title: string;
		description: string;
		location: string;
	}>();

	const votesOfOption = (optionId: number) => props.votesByOption.find((vote) => vote.optionId === optionId)?.votes ?? [];
</script>
