<template>
	<span>{{ name }}</span>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';
	import Room from '@/model/rooms/Room';
	const { t } = useI18n();

	const props = defineProps({
		room: {
			type: Room,
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
