<template>
	<ViewVotesSchedulerOption v-for="option in options" :key="option.id" :option="option" :votes="votesOfOption(option.id)" :hideTime="false"></ViewVotesSchedulerOption>
</template>

<script setup lang="ts">
	// Components
	import ViewVotesSchedulerOption from '@hub-client/components/rooms/voting/view-votes/ViewVotesSchedulerOption.vue';

	// Models
	import { SchedulerOption } from '@hub-client/models/events/voting/VotingTypes';

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
