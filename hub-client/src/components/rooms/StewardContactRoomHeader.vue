<template>
	<div class="flex flex-row gap-2">
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">{{ t('rooms.steward_support') }}</p>
			<p class="flex leading-tight ~text-label-small-min/label-small-max">
				<span class="pr-1">{{ t('rooms.contact') }}</span
				>{{ roomNameForStewardContact }}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useRooms } from '@/logic/store/store';
	import Room from '@/model/rooms/Room';

	import { TRoomMember } from '@/model/rooms/TRoomMember';

	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const rooms = useRooms();

	const roomNameForStewardContact = computed(() => {
		return rooms.fetchRoomById(props.room.name.split(',')[0]).name;
	});

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
</script>
