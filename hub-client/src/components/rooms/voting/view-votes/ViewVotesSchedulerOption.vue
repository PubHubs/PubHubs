<template>
	<div>
		<div class="flex gap-2 py-2">
			<!-- Yes Votes -->
			<OptionButton color="bg-accent-lime">
				<Icon class="ml-1" type="checkmark" size="xs" />
			</OptionButton>
			<div>{{ yesVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', yesVotes.length) }}</div>
			<div class="mr-2 flex gap-2" v-for="vote in yesVotes" :key="vote[0]">
				<AvatarDisplayName class="h-5 w-5" :userId="vote[0]"></AvatarDisplayName>
				<UserDisplayName :userId="vote[0]" :userDisplayName="user.userDisplayName(vote[0])"></UserDisplayName>
			</div>
		</div>
		<div class="flex gap-2 py-2">
			<!-- Maybe Votes -->
			<OptionButton color="bg-accent-orange">
				<div class="-mt-1 text-3xl">~</div>
			</OptionButton>
			<div>{{ maybeVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', maybeVotes.length) }}</div>
			<div class="mr-2 flex gap-2" v-for="vote in maybeVotes" :key="vote[0]">
				<AvatarDisplayName class="h-5 w-5" :userId="vote[0]"></AvatarDisplayName>
				<UserDisplayName :userId="vote[0]" :userDisplayName="user.userDisplayName(vote[0])"></UserDisplayName>
			</div>
		</div>
		<div class="flex gap-2 py-2">
			<!-- No Votes -->
			<OptionButton color="bg-accent-red">
				<Icon class="ml-1" type="closingCross" size="xs" />
			</OptionButton>
			<div>{{ noVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', noVotes.length) }}</div>
			<div class="mr-2 flex gap-2" v-for="vote in noVotes" :key="vote[0]">
				<AvatarDisplayName class="h-5 w-5" :userId="vote[0]"></AvatarDisplayName>
				<UserDisplayName :userId="vote[0]" :userDisplayName="user.userDisplayName(vote[0])"></UserDisplayName>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const user = useUser();

	const props = defineProps<{
		votes: {
			userTime: {
				id: string;
				time: string;
			}[];
			choice: string;
		}[];
	}>();

	const yesVotes = props.votes.filter((vote) => vote.choice === 'yes')[0].userTime;
	const maybeVotes = props.votes.filter((vote) => vote.choice === 'maybe')[0].userTime;
	const noVotes = props.votes.filter((vote) => vote.choice === 'no')[0].userTime;
</script>
