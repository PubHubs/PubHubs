<template>
	<div v-click-outside="close">
		<EmojiPicker
			v-if="emojiPanel"
			@emoji-selected="
				sendReactEvent($event);
				close();
			"
		></EmojiPicker>
		<div v-else class="group relative flex cursor-pointer flex-wrap items-center gap-4 rounded-full border bg-surface-high px-2 py-1">
			<span
				v-for="item in defaultEmojis"
				:key="item"
				@click="
					sendReactEvent(item);
					close();
				"
			>
				{{ item }}
			</span>
			<button
				@click.stop="openEmojiPanel()"
				class="relative flex items-center justify-center rounded-md p-1 text-on-surface-variant transition-all duration-300 ease-in-out hover:w-fit hover:bg-accent-primary hover:text-on-accent-primary"
			>
				<Icon type="plus" size="xs"></Icon>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	import Icon from '../elements/Icon.vue';
	import EmojiPicker from './EmojiPicker.vue';

	import Room from '@/model/rooms/Room';
	import { useUser } from '@/logic/store/user';

	const user = useUser();
	const emojiPanel = ref(false);

	// Default emojis to show in the panel.
	const defaultEmojis = ['👍', '🎉', '😂', '😮', '😢', '👏'];

	const props = defineProps<{ eventId: string; room: Room }>();
	const emit = defineEmits<{ (e: 'emojiSelected', emoji: string): void; (e: 'closePanel'): void }>();

	function openEmojiPanel() {
		emojiPanel.value = true;
	}

	function sendReactEvent(emoji: string) {
		// Don't send same emoji on same event by the same user.
		if (checkIfSameReactExists(emoji)) return;
		emit('emojiSelected', emoji);
	}

	function close() {
		emit('closePanel');
	}

	// Matrix throws an error if same event is sent twice. Also this avoids unnecessary request sent to matrix.
	function checkIfSameReactExists(emoji: string): boolean {
		const reactEvents = props.room.getReactEventsFromTimeLine();
		return reactEvents.some((event) => event.getContent()['m.relates_to']?.event_id === props.eventId && event.getContent()['m.relates_to']?.key === emoji && event.getSender() === user.user.userId);
	}
</script>
