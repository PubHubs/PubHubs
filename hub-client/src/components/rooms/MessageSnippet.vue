<template>
	<div class="flex cursor-pointer items-center gap-3 truncate text-nowrap rounded-md px-2" :class="showInReplyTo ? 'bg-surface-high' : 'bg-surface-low'">
		<p v-if="showInReplyTo" class="text-nowrap">
			{{ $t('message.in_reply_to') }}
		</p>
		<p :class="textColor(userColor)">
			<UserDisplayName :user="event.sender || 'Deleted user'" :room="room" />
		</p>
		<div class="flex w-full items-center gap-1" :class="{ 'text-accent-error': redactedMessage }" :title="snippetText">
			<Icon v-if="redactedMessage" :type="'bin'" :size="'sm'" />
			<p class="line-clamp-1">{{ snippetText }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import UserDisplayName from './UserDisplayName.vue';
	import Icon from '../elements/Icon.vue';

	import { useUserColor } from '@/logic/composables/useUserColor';
	import { computed } from 'vue';
	import Room from '@/model/rooms/Room';
	import { useI18n } from 'vue-i18n';
	import { usePubHubs } from '@/logic/core/pubhubsStore';

	const { color, textColor } = useUserColor();
	const pubhubs = usePubHubs();
	const { t } = useI18n();

	type Props = {
		eventId: string;
		// Whether or not to show the text "In reply to:" inside the snippet.
		showInReplyTo?: boolean;
		room: Room;
	};

	const props = withDefaults(defineProps<Props>(), {
		showInReplyTo: false,
	});

	const event = await pubhubs.getEvent(props.room.roomId, props.eventId);

	const userColor = computed(() => color(event.sender!) || 0);
	const text = computed(() => {
		return event.content?.body as string;
	});

	const redactedMessage = computed(() => {
		const inRedactedMessageIds = event.event_id && props.room.inRedactedMessageIds(event.event_id);
		const containsRedactedBecause = event.unsigned?.redacted_because != undefined;
		return inRedactedMessageIds || containsRedactedBecause;
	});

	const snippetText = computed(() => {
		return redactedMessage.value ? t('message.delete.original_message_deleted') : text.value;
	});
</script>
