<template>
	<div class="relative z-0">
		<div class="bg-background hover:bg-surface-high flex cursor-pointer justify-between rounded-t-lg px-5 py-2" @click="$emit('vote', option.id)" role="link">
			<div class="flex items-center gap-2">
				<div class="flex-none" v-if="hasUserVotedOnThisOption">
					<Icon type="check-circle" class="text-accent-primary" />
				</div>
				<div class="relative" v-else>
					<Icon type="circle" />
				</div>
				<div class="flex items-center gap-1">
					<span>{{ option.title }}</span>
					<span v-if="showVotes">({{ userIds.length }}&nbsp;{{ $t('message.voting.plural_votes', userIds.length) }})</span>
				</div>
			</div>
			<div v-if="showVotesBeforeVoting || hasUserVotedOnThisOption || hasUserVotedOnOtherOption" class="flex flex-wrap items-center gap-2">
				<AvatarDisplayName class="max-sm:hidden" v-for="userId in userIds.slice(0).slice(-3)" :key="userId" :userId="userId" :showDisplayname="showVotes" />
			</div>
		</div>
		<ProgressBar class="relative -z-10 -mt-2 mb-2" :percentage="percentage"></ProgressBar>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AvatarDisplayName from '@hub-client/components/ui/AvatarDisplayName.vue';
	import ProgressBar from '@hub-client/components/ui/ProgressBar.vue';

	// Models
	import { PollOption } from '@hub-client/models/events/voting/VotingTypes';

	defineEmits(['vote']);

	defineProps<{
		option: PollOption;
		userIds: string[];
		hasUserVotedOnThisOption: boolean;
		hasUserVotedOnOtherOption: boolean;
		percentage: number;
		showVotesBeforeVoting: boolean | undefined;
		showVotes: boolean;
	}>();
</script>
