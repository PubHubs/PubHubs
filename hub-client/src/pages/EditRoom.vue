<template>
	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="text-on-surface-dim hidden items-center gap-4 md:flex">
				<span class="font-semibold uppercase">{{ $t('admin.title_administrator') }}</span>
				<hr class="bg-on-surface-dim h-[2px] grow" />
			</div>
			<div class="flex h-full items-center">
				<div class="flex w-fit items-center gap-3">
					<Icon type="caret-left" data-testid="back" class="cursor-pointer" @click="close()" />
					<H3 class="font-headings text-on-surface font-semibold">{{ $t('menu.admin_tools_room', [roomName]) }}</H3>
				</div>
			</div>
		</template>

		<EditRoomForm :room="room" :secured="isSecured" @close="close()" />
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import EditRoomForm from '@hub-client/components/rooms/EditRoomForm.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';

	import { router } from '@hub-client/logic/core/router';

	import { useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();

	// Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
	});

	const room = computed(() => {
		return rooms.room(props.id)?.matrixRoom;
	});

	const roomName = computed(() => {
		return room.value?.name;
	});

	const isSecured = computed(() => {
		return rooms.roomIsSecure(props.id);
	});

	function close() {
		router.push({ name: 'admin' });
	}
</script>
