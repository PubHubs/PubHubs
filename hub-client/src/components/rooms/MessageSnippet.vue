<template>
	<div class="bg-hub-background-3 flex px-2 gap-3 items-center rounded-md cursor-pointer">
		<p v-if="showInReplyTo" class="text-nowrap">
			{{ $t('message.in_reply_to') }}
		</p>
		<p :class="textColor(userColor)">
			<UserDisplayName :user="event.sender" :room="room"></UserDisplayName>
		</p>
		<p class="truncate flex items-center gap-1" :class="{ 'theme-light:text-gray-middle dark:text-gray-lighter': redactedMessage }" :title="snippetText">
			<Icon v-if="redactedMessage" :type="'bin'" :size="'sm'"></Icon>
			<span class="truncate">{{ snippetText }}</span>
		</p>
	</div>
</template>

<script setup lang="ts">
	// Components
	import UserDisplayName from './UserDisplayName.vue';
	import Icon from '../elements/Icon.vue';

	import { useUserColor } from '@/composables/useUserColor';
	import { computed } from 'vue';
	import Room from '@/model/rooms/Room';
	import { useI18n } from 'vue-i18n';
	import { usePubHubs } from '@/core/pubhubsStore';

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
