<template>
	<AvatarCore :user="user" :img="image"></AvatarCore>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useUser } from '@/logic/store/user';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { User as MatrixUser } from 'matrix-js-sdk';

	//Components
	import AvatarCore from '@/components/ui/AvatarCore.vue';

	const currentUser = useUser();
	const pubhubs = usePubHubs();

	type Props = {
		userId: string;
	};

	const props = defineProps<Props>();
	const user = computed(getMatrixUser);
	const image = computed(getImage);

	function getMatrixUser(): MatrixUser | undefined {
		if (pubhubs.client.getUser) {
			return pubhubs.client.getUser(props.userId)!;
		}
		return undefined;
	}

	function getImage(): string | undefined {
		if (!user.value) return undefined;
		let url = '';
		if (user.value.avatarUrl && user.value.avatarUrl !== '') {
			url = user.value.avatarUrl;
		}

		// This is needed to reflect local changes to the users avatar immediatly
		if (userIsCurrentUser()) {
			url = currentUser.avatarUrl;
			if (currentUser._avatarUrl) {
				url = currentUser._avatarUrl;
			}
		}
		return url;
	}

	function userIsCurrentUser(): boolean {
		if (user.value?.userId && user.value?.userId === currentUser.userId) return true;
		return false;
	}
</script>
