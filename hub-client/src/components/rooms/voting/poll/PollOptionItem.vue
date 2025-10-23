<template>
	<div class="relative z-0">
		<div class="flex cursor-pointer justify-between rounded-t-lg bg-background px-5 py-2 hover:bg-surface-high" @click="$emit('vote', option.id)" role="link">
			<div class="flex">
				<div class="relative mr-4 flex-none" v-if="hasUserVotedOnThisOption">
					<div class="relative left-1 top-1 h-4 w-4 rounded-full bg-accent-primary"></div>
					<Icon type="checkmark_circle" class="absolute top-0" />
				</div>
				<div class="relative mr-8" v-else>
					<Icon type="circle" class="absolute" />
				</div>
				<div class="flex">
					<span>{{ option.title }}</span>
					<span v-if="showVotes" class="ml-1">({{ userIds.length }}&nbsp;{{ $t('message.voting.plural_votes', userIds.length) }})</span>
				</div>
			</div>
			<div v-if="showVotesBeforeVoting || hasUserVotedOnThisOption || hasUserVotedOnOtherOption" class="flex flex-wrap">
				<AvatarDisplayName class="-mr-4 max-sm:hidden" v-for="userId in userIds.slice(0).slice(-3)" :key="userId" :userId="userId" :showDisplayname="showVotes" />
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
