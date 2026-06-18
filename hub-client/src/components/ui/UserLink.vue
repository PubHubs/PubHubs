<template>
	<div
		role="link"
		tabindex="0"
		class="hover:bg-surface-sunken flex w-full cursor-pointer items-center gap-100 rounded p-100"
		@click="navigate"
		@keydown.enter="navigate"
		@keydown.space.prevent="navigate"
	>
		<UserBadge
			:user-id="userId"
			:size="size"
		/>
	</div>
</template>

<script lang="ts" setup>
	import { useRouter } from 'vue-router';

	// Components
	import UserBadge from '@hub-client/components/ui/UserBadge.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			userId: string;
			size?: 'sm' | 'md' | 'lg';
		}>(),
		{
			size: 'md',
		},
	);

	const router = useRouter();

	function navigate() {
		router.push({ name: 'manage-users', query: { userId: props.userId } });
	}
</script>
