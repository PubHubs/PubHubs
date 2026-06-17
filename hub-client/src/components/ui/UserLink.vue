<template>
	<router-link
		:to="{ name: 'manage-users', query: { userId: userId } }"
		class="hover:bg-surface-low rounded-md p-1 transition-colors"
	>
		<UserBadge
			:user-id="userId"
			:size="size"
		/>
	</router-link>
</template>

<script lang="ts" setup>
	// Components
	import UserBadge from '@hub-client/components/ui/UserBadge.vue';

	withDefaults(
		defineProps<{
			userId: string;
			size?: 'sm' | 'md' | 'lg';
		}>(),
		{
			size: 'md',
		},
	);
</script>
