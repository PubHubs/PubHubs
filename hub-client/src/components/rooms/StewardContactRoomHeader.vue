<template>
	<div class="flex flex-row gap-2">
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">{{ t('rooms.steward_support') }}</p>
			<p class="flex leading-tight text-label-small">
				<span class="pr-1">{{ t('rooms.contact') }}</span
				>{{ roomNameForStewardContact }}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { TRoomMember } from '@hub-client/models/rooms/TRoomMember';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	const { t } = useI18n();
	const rooms = useRooms();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		members: {
			type: Array<TRoomMember>,
			required: true,
		},
	});

	const roomNameForStewardContact = computed(() => {
		return rooms.fetchRoomById(props.room.name.split(',')[0]).name;
	});
</script>
