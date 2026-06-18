<template>
	<router-link
		:to="{ name: 'manage-users', query: { userId: userId } }"
		class="hover:bg-surface-elevated p-050 rounded transition-colors"
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
