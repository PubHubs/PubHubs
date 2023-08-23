<template>
	<Dialog :buttons="buttonsOk" width="w-3/6" @close="close()">
		<template #header>
			{{ $t('rooms.private_add') }}
		</template>
		<FilteredList :items="users" filterKey="displayName" :placeholder="$t('rooms.private_search_user')" @click="addNewPrivateRoom($event)">
			<template #item="{ item }">
				<span :title="item.userId">{{ item.displayName }}</span>
				<Icon type="plus" class="float-right"></Icon>
			</template>
		</FilteredList>
	</Dialog>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { User, useUser, PubHubsRoomType } from '@/store/store';
	import { buttonsOk } from '@/store/dialog';

	const pubhubs = usePubHubs();
	const user = useUser();
	const emit = defineEmits(['close']);

	const users = ref([] as Array<MatrixUser>);

	onMounted(async () => {
		users.value = await pubhubs.getUsers();
	});

	async function addNewPrivateRoom(other: any) {
		const me = user.user as User;
		await pubhubs.newRoom({
			name: `${me.userId},${other.userId}`,
			visibility: 'private',
			invite: [other.userId],
			is_direct: true,
			creation_content: { type: PubHubsRoomType.PH_MESSAGES_DM },
			topic: `PRIVATE: ${me.userId}, ${other.userId}`,
			history_visibility: 'shared',
			guest_can_join: false,
		});
		// Returns invalid user id - 400, when no such user. So nice
		close();
	}

	async function close() {
		emit('close');
	}
</script>
