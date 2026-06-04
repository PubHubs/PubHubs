<template>
	<div class="flex flex-col gap-200 p-200">
		<div class="flex gap-200">
			<!-- Yes Votes -->
			<OptionButton color="bg-accent-green text-on-accent-green">
				<Icon
					type="check"
					class="m-auto"
				/>
			</OptionButton>
			<div>{{ yesVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', yesVotes.length) }}</div>
			<div
				v-for="vote in yesVotes"
				:key="vote.userId"
				class="mr-2 flex gap-2"
			>
				<UserDisplayName
					:user-id="vote.userId"
					:user-display-name="user.userDisplayName(vote.userId)"
				></UserDisplayName>
			</div>
		</div>
		<div class="flex gap-200">
			<!-- Maybe Votes -->
			<OptionButton color="bg-accent-orange text-on-accent-orange">
				<Icon
					type="tilde"
					class="m-auto"
				/>
			</OptionButton>
			<div>{{ maybeVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', maybeVotes.length) }}</div>
			<div
				v-for="vote in maybeVotes"
				:key="vote.userId"
				class="mr-2 flex gap-2"
			>
				<UserDisplayName
					:user-id="vote.userId"
					:user-display-name="user.userDisplayName(vote.userId)"
				></UserDisplayName>
			</div>
		</div>
		<div class="flex gap-200">
			<!-- No Votes -->
			<OptionButton color="bg-accent-red text-on-accent-red">
				<Icon
					type="x"
					class="m-auto"
				/>
			</OptionButton>
			<div>{{ noVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', noVotes.length) }}</div>
			<div
				v-for="(vote, index) in noVotes"
				:key="index"
				class="mr-2 flex gap-2"
			>
				<UserDisplayName
					:user-id="vote.userId"
					:user-display-name="user.userDisplayName(vote.userId)"
				></UserDisplayName>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import OptionButton from '@hub-client/components/rooms/voting/scheduler/OptionButton.vue';

	// Models
	import { type UserVote } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps<{
		votes: {
			userVotes: UserVote[];
			choice: string;
		}[];
	}>();

	const user = useUser();

	const yesVotes = props.votes.filter((vote) => vote.choice === 'yes')[0].userVotes;
	const maybeVotes = props.votes.filter((vote) => vote.choice === 'maybe')[0].userVotes;
	const noVotes = props.votes.filter((vote) => vote.choice === 'no')[0].userVotes;
</script>
