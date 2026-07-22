<template>
	<div class="flex min-w-0 items-center gap-200">
		<Avatar
			class="shrink-0"
			:class="avatarSize"
			:avatar-url="userStore.userAvatar(userId)"
			:user-id="userId"
		/>
		<UserDisplayName
			class="min-w-0"
			:user-id="userId"
			:user-display-name="userStore.userDisplayName(userId)"
			:enable-d-m="false"
		/>
		<div class="shrink-0">
			<slot />
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Components
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const props = withDefaults(
		defineProps<{
			userId: string;
			size?: 'sm' | 'md' | 'lg';
		}>(),
		{
			size: 'md',
		},
	);

	const userStore = useUser();

	const avatarSize = computed(() => {
		switch (props.size) {
			case 'sm':
				return 'h-5 w-5';
			case 'lg':
				return 'h-8 w-8';
			default:
				return 'h-6 w-6';
		}
	});
</script>
