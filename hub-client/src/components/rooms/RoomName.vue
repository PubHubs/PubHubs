<template>
	<span :title="name">{{ name }}</span>
</template>

<script setup lang="ts">
	// Packages
	import { PropType, computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { RoomListRoom } from '@hub-client/models/rooms/TBaseRoom';

	const { t } = useI18n();

	const props = defineProps({
		room: {
			type: Object as PropType<Room | RoomListRoom>,
		},
	});

	// The general room name is of the form #General:<server_name>.
	const name = computed(() => {
		if (props.room?.name.startsWith('#General:')) {
			return t('rooms.name_general_room');
		} else if (props.room?.name.startsWith('#Feedback:')) {
			return t('rooms.name_feedback_room');
		} else {
			return props.room?.name;
		}
	});
</script>
