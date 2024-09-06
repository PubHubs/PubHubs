<template>
	<div class="bg-hub-background-3 flex px-2 gap-3 items-center rounded-md cursor-pointer">
		<p v-if="showInReplyTo" class="text-nowrap">
			{{ $t('message.in_reply_to') }}
		</p>
		<p :class="textColor(userColor)">
			<UserDisplayName :user="event.sender" :room="room"></UserDisplayName>
		</p>
		<p class="truncate" :title="text">{{ text }}</p>
	</div>
</template>

<script setup lang="ts">
	import { useUserColor } from '@/composables/useUserColor';
	import { M_MessageEvent } from '@/types/events';
	import { computed } from 'vue';
	import Room from '@/model/rooms/Room';

	const { color, textColor } = useUserColor();

	type Props = {
		event: M_MessageEvent;
		// Whether or not to show the text "In reply to:" inside the snippet.
		showInReplyTo?: boolean;
		room: Room;
	};

	const props = withDefaults(defineProps<Props>(), {
		showInReplyTo: false,
	});

	const userColor = computed(() => color(props.event.sender) || 0);
	const text = computed(() => {
		return props.event.content?.body as string;
	});
</script>
