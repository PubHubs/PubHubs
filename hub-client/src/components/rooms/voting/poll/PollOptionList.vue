<template>
	<div role="list">
		<PollOptionItem
			v-for="option in options"
			:key="option.id"
			:has-user-voted-on-other-option="hasUserVotedOnOtherOption(option.id)"
			:has-user-voted-on-this-option="hasUserVotedOnOption(option.id)"
			:option="option"
			:percentage="percentageOfOption(option.id)"
			role="listitem"
			:show-votes="showVotes"
			:show-votes-before-voting="showVotesBeforeVoting"
			:user-votes="votesOfOption(option.id)"
			@vote="vote"
		/>
	</div>
</template>
<script lang="ts" setup>
	// Components
	import PollOptionItem from '@hub-client/components/rooms/voting/poll/PollOptionItem.vue';

	// Models
	import { type PollOption, type UserVote, type votesForOption } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		options: PollOption[];
		votesByOption: votesForOption[];
		hasUserVoted: boolean;
		eventId: string;
		showVotesBeforeVoting: boolean | undefined;
		showVotes: boolean;
	}>();
	const pubhubs = usePubhubsStore();
	const rooms = useRooms();

	const user = useUser();

	const votesOfOption = (optionId: number): UserVote[] => {
		return props.votesByOption.find((vote) => vote.optionId === optionId)?.votes[0].userVotes ?? [];
	};
	const hasUserVotedOnOption = (optionId: number) => {
		return votesOfOption(optionId).some((uv) => uv.userId === (user.userId ?? ''));
	};
	const hasUserVotedOnOtherOption = (optionId: number) => {
		for (const option of props.votesByOption) {
			if (votesOfOption(option.optionId).some((uv) => uv.userId === (user.userId ?? '')) && option.optionId !== optionId) {
				return true;
			}
		}
		return false;
	};

	const percentageOfOption = (optionId: number) => {
		const hasUserVoted = props.votesByOption.some((vote) => vote.votes.some((v) => v.userVotes.some((uv) => uv.userId === (user.userId ?? ''))));
		const showVotesBeforeVoting = props.showVotesBeforeVoting;
		if (!showVotesBeforeVoting && !hasUserVoted) return 0;
		const votes = votesOfOption(optionId).length;
		const totalVotes = props.votesByOption.reduce((acc, vote) => acc + vote.votes.flatMap((v) => v.userVotes).length, 0);
		if (totalVotes === 0) return 0;
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
