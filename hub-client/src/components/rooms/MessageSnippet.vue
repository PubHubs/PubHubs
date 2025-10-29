<template>
	<div class="flex cursor-pointer items-center gap-3 truncate text-nowrap rounded-md px-2" :class="showInReplyTo ? 'bg-surface-high' : 'bg-surface-low'">
		<p v-if="showInReplyTo" class="text-nowrap">
			{{ t('message.in_reply_to') }}
		</p>
		<p :class="textColor(userColor)">
			<UserDisplayName :userId="event.sender || t('delete.user')" />
		</p>
		<div class="flex w-full items-center gap-1" :class="{ 'text-accent-error': redactedMessage }" :title="snippetText">
			<Icon v-if="redactedMessage" type="trash" :size="'sm'" />
			<p class="line-clamp-1">{{ snippetText }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		eventId: string;
		// Whether or not to show the text "In reply to:" inside the snippet.
		showInReplyTo?: boolean;
		room: Room;
	};

	const { color, textColor } = useUserColor();
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const { t } = useI18n();

	const props = withDefaults(defineProps<Props>(), {
		showInReplyTo: false,
	});

	const event = await pubhubs.getEvent(props.room.roomId, props.eventId);

	const userColor = computed(() => color(event.sender!) || 0);
	const text = computed(() => {
		return event.content?.body as string;
	});

	const redactedMessage = computed(() => {
		const isDeletedEvent = event.event_id && props.room.isDeletedEvent(event.event_id);
		const containsRedactedBecause = event.unsigned?.redacted_because != undefined;
		return isDeletedEvent || containsRedactedBecause;
	});

	const snippetText = computed(() => {
		return redactedMessage.value ? t('message.delete.original_message_deleted') : text.value;
	});
</script>
