<template>
	<div class="relative z-0">
		<div
			class="bg-background hover:bg-surface-high flex cursor-pointer justify-between rounded-t-lg px-5 py-2"
			role="link"
			@click="$emit('vote', option.id)"
		>
			<div class="flex items-center gap-2">
				<div
					v-if="hasUserVotedOnThisOption"
					class="flex-none"
				>
					<Icon
						class="text-accent-primary"
						type="check-circle"
					/>
				</div>
				<div
					v-else
					class="relative"
				>
					<Icon type="circle" />
				</div>
				<div class="flex items-center gap-1">
					<span>{{ option.title }}</span>
					<span v-if="showVotes">({{ userVotes.length }}&nbsp;{{ $t('message.voting.plural_votes', userVotes.length) }})</span>
				</div>
			</div>
			<div
				v-if="showVotesBeforeVoting || hasUserVotedOnThisOption || hasUserVotedOnOtherOption"
				class="flex flex-wrap items-center gap-2"
			>
				<AvatarDisplayName
					v-for="userVote in userVotes.slice(0).slice(-3)"
					:key="userVote.userId"
					class="max-sm:hidden"
					:show-displayname="showVotes"
					:user-id="userVote.userId"
				/>
			</div>
		</div>
		<ProgressBar
			class="relative -z-10 -mt-2 mb-2"
			:percentage="percentage"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AvatarDisplayName from '@hub-client/components/ui/AvatarDisplayName.vue';
	import ProgressBar from '@hub-client/components/ui/ProgressBar.vue';

	// Models
	import { type PollOption, type UserVote } from '@hub-client/models/events/voting/VotingTypes';

	defineProps<{
		option: PollOption;
		userVotes: UserVote[];
		hasUserVotedOnThisOption: boolean;
		hasUserVotedOnOtherOption: boolean;
		percentage: number;
		showVotesBeforeVoting: boolean | undefined;
		showVotes: boolean;
	}>();

	defineEmits(['vote']);
</script>
