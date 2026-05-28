<template>
	<ViewVotesSchedulerOption
		v-for="option in options"
		:key="option.id"
		:hide-time="false"
		:option="option"
		:votes="votesOfOption(option.id)"
	/>
</template>

<script lang="ts" setup>
	// Components
	import ViewVotesSchedulerOption from '@hub-client/components/rooms/voting/view-votes/ViewVotesSchedulerOption.vue';

	// Models
	import { type SchedulerOption, type UserVote } from '@hub-client/models/events/voting/VotingTypes';

	const props = defineProps<{
		options: SchedulerOption[];
		votesByOption: {
			optionId: number;
			votes: {
				userVotes: UserVote[];
				choice: string;
			}[];
		}[];
		title: string;
		description: string;
		location: string;
	}>();

	const votesOfOption = (optionId: number) => props.votesByOption.find((vote) => vote.optionId === optionId)?.votes ?? [];
</script>
