<template>
	<PollOptionItem
		v-for="option in options"
		:key="option.id"
		:option="option"
		:userIds="votesOfOption(option.id)"
		:hasUserVotedOnThisOption="hasUserVotedOnOption(option.id)"
		:hasUserVotedOnOtherOption="hasUserVotedOnOtherOption(option.id)"
		:percentage="percentageOfOption(option.id)"
		:showVotesBeforeVoting="showVotesBeforeVoting"
		:showVotes="showVotes"
		@vote="vote"
	/>
</template>
<script setup lang="ts">
	import PollOptionItem from '@/components/rooms/voting/poll/PollOptionItem.vue';
	import { useUser } from '@/logic/store/user';
	import { useRooms } from '@/logic/store/rooms';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { PollOption, votesForOption } from '@/model/events/voting/VotingTypes';

	const pubhubs = usePubHubs();
	const rooms = useRooms();

	const props = defineProps<{
		options: PollOption[];
		votesByOption: votesForOption[];
		hasUserVoted: boolean;
		eventId: string;
		showVotesBeforeVoting: boolean | undefined;
		showVotes: boolean;
	}>();

	const user = useUser();

	const votesOfOption = (optionId: number) => {
		return props.votesByOption.find((vote) => vote.optionId === optionId)?.votes[0].userIds ?? [];
	};
	const hasUserVotedOnOption = (optionId: number) => {
		return votesOfOption(optionId).includes(user.user.userId);
	};
	const hasUserVotedOnOtherOption = (optionId: number) => {
		for (const option of props.votesByOption) {
			if (votesOfOption(option.optionId).includes(user.user.userId) && option.optionId !== optionId) {
				return true;
			}
		}
		return false;
	};

	const percentageOfOption = (optionId: number) => {
		const hasUserVoted = props.votesByOption.some((vote) => vote.votes.some((v) => v.userIds.includes(user.user.userId)));
		const showVotesBeforeVoting = props.showVotesBeforeVoting;
		if (!showVotesBeforeVoting && !hasUserVoted) return 0;
		const votes = votesOfOption(optionId).length;
		const totalVotes = props.votesByOption.reduce((acc, vote) => acc + vote.votes.flatMap((v) => v.userIds).length, 0);
		if (totalVotes == 0) return 0;
		return (votes / totalVotes) * 100;
	};

	const vote = (optionId: number) => {
		const newVote = !hasUserVotedOnOption(optionId);
		if (newVote) {
			pubhubs.addVote(rooms.currentRoomId, props.eventId, optionId, 'yes');
		} else {
			pubhubs.addVote(rooms.currentRoomId, props.eventId, optionId, 'redacted');
		}
	};
</script>
