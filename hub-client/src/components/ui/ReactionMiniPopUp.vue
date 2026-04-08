<template>
	<div
		v-click-outside="close"
		data-testid="react-mini-popup"
	>
		<EmojiPicker
			v-if="emojiPanel"
			@emoji-selected="
				sendReactEvent($event);
				close();
			"
		/>
		<div
			v-else
			class="group bg-surface-high relative flex cursor-pointer flex-wrap items-center gap-4 rounded-full border px-2 py-1"
			role="list"
		>
			<span
				v-for="item in defaultEmojis"
				:key="item"
				role="listitem"
				@click="
					sendReactEvent(item);
					close();
				"
			>
				{{ item }}
			</span>
			<button
				class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary relative flex items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:w-fit"
				@click.stop="openEmojiPanel()"
			>
				<Icon
					size="xs"
					type="plus"
				/>
			</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
	import Icon from '../elements/Icon.vue';
	import EmojiPicker from './EmojiPicker.vue';
	import { ref } from 'vue';

	import type Room from '@hub-client/models/rooms/Room';

	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{ eventId: string; room: Room }>();
	const emit = defineEmits<{ (e: 'emojiSelected', emoji: string): void; (e: 'closePanel'): void }>();
	const user = useUser();
	const emojiPanel = ref(false);

	// Default emojis to show in the panel.
	const defaultEmojis = ['👍', '🎉', '😂', '😮', '😢', '👏'];

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
		return reactEvents.some(
			(event) =>
				event.getContent()['m.relates_to']?.event_id === props.eventId &&
				event.getContent()['m.relates_to']?.key === emoji &&
				event.getSender() === user.userId,
		);
	}
</script>
