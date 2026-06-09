<template>
	<div
		class="bg-surface-background rounded-base border-surface-elevated relative z-0 mb-100 flex flex-col overflow-clip border-3"
		:class="!showVotes && 'h-800'"
	>
		<div
			class="flex h-full min-h-600 justify-between px-200 py-100"
			role="link"
			:class="!closed && 'cursor-pointer'"
			@click="$emit('vote', option.id)"
		>
			<div class="flex items-center gap-2">
				<div
					v-if="hasUserVotedOnThisOption"
					class="flex-none"
				>
					<Icon
						class="text-accent-primary"
						:class="!closed && 'hover:opacity-50'"
						type="check-circle"
					/>
				</div>
				<div
					v-else
					class="relative"
					:class="!closed && 'group/check'"
				>
					<Icon
						class="text-surface-base"
						:class="!closed ? 'group-hover/check:hidden' : ''"
						type="circle"
					/>
					<Icon
						class="text-accent-primary/50"
						:class="!closed ? 'hidden group-hover/check:inline' : 'hidden'"
						type="check-circle"
					/>
				</div>
				<div class="flex items-center gap-1">
					<span>{{ option.title }}</span>
					<span v-if="showVotes">({{ votes.length }}&nbsp;{{ $t('message.voting.plural_votes', votes.length) }})</span>
				</div>
			</div>
			<div
				v-if="showVotesBeforeVoting || hasUserVotedOnThisOption || hasUserVotedOnOtherOption"
				class="flex items-center gap-2"
			>
				<Avatar
					v-for="userId in userIds.slice(0).slice(-3)"
					:key="userId"
					class="h-full max-h-12 w-auto max-sm:hidden"
					:avatar-url="user.userAvatar(userId)"
					:user-id="userId"
				/>
			</div>
		</div>
		<div
			v-if="showVotes && votes.length > 0"
			class="bg-surface-background flex flex-col gap-100 p-200"
		>
			<div
				v-for="vote in votes"
				:key="vote.userId"
				class="flex gap-100"
			>
				<UserDisplayName
					:user-id="vote.userId"
					:user-display-name="user.userDisplayName(vote.userId)"
				/>
			</div>
		</div>
		<ProgressBar :percentage="percentage" />
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import ProgressBar from '@hub-client/components/ui/ProgressBar.vue';

	// Models
	import { type PollOption } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Props
	defineProps<{
		option: PollOption;
		userIds: string[];
		votes: { userId: string; time: string }[];
		hasUserVotedOnThisOption: boolean;
		hasUserVotedOnOtherOption: boolean;
		percentage: number;
		showVotesBeforeVoting: boolean | undefined;
		showVotes: boolean;
		closed: boolean;
	}>();

	defineEmits(['vote']);

	const user = useUser();
</script>
