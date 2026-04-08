<template>
	<div>
		<div class="flex gap-2 py-2">
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
				:key="vote.id"
				class="mr-2 flex gap-2"
			>
				<UserDisplayName
					:user-id="vote.id"
					:user-display-name="user.userDisplayName(vote.id)"
				></UserDisplayName>
			</div>
		</div>
		<div class="flex gap-2 py-2">
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
				:key="vote.id"
				class="mr-2 flex gap-2"
			>
				<UserDisplayName
					:user-id="vote.id"
					:user-display-name="user.userDisplayName(vote.id)"
				></UserDisplayName>
			</div>
		</div>
		<div class="flex gap-2 py-2">
			<!-- No Votes -->
			<OptionButton color="bg-accent-red text-on-accent-red">
				<Icon
					type="x"
					class="m-auto"
				/>
			</OptionButton>
			<div>{{ noVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', noVotes.length) }}</div>
			<div
				v-for="vote in noVotes"
				:key="vote.id"
				class="mr-2 flex gap-2"
			>
				<UserDisplayName
					:user-id="vote.id"
					:user-display-name="user.userDisplayName(vote.id)"
				></UserDisplayName>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		votes: {
			userTime: {
				id: string;
				time: string;
			}[];
			choice: string;
		}[];
	}>();

	const user = useUser();

	const yesVotes = props.votes.filter((vote) => vote.choice === 'yes')[0].userTime;
	const maybeVotes = props.votes.filter((vote) => vote.choice === 'maybe')[0].userTime;
	const noVotes = props.votes.filter((vote) => vote.choice === 'no')[0].userTime;
</script>
