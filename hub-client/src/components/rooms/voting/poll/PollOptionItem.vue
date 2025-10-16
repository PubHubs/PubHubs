<template>
	<div class="relative z-0">
		<div class="flex cursor-pointer justify-between rounded-t-lg bg-background px-5 py-2 hover:bg-surface-high" @click="$emit('vote', option.id)" role="link">
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
	import Icon from '@/components/elements/Icon.vue';
	import AvatarDisplayName from '@/components/ui/AvatarDisplayName.vue';
	import { PollOption } from '@/model/events/voting/VotingTypes';
	import ProgressBar from '@/components/ui/ProgressBar.vue';

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
