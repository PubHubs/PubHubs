<template>
	<div
		class="rounded-base flex w-fit cursor-pointer items-center gap-150 truncate px-100 text-nowrap"
		:class="showInReplyTo ? 'bg-surface-base border-surface-elevated border-3' : 'bg-surface-background'"
	>
		<Icon
			v-if="showInReplyTo"
			class="text-on-surface-dim shrink-0"
			size="sm"
			type="arrow-bend-up-left"
		/>
		<p :class="textColor(userColor)">
			<UserDisplayName
				:user-display-name="user.userDisplayName(event.sender ?? '')"
				:user-id="event.sender || t('delete.user')"
			/>
		</p>
		<div
			class="gap-050 flex w-full items-center"
			:class="{ 'text-accent-error': redactedMessage }"
			:title="snippetText"
		>
			<Icon
				v-if="redactedMessage"
				:size="'sm'"
				type="trash"
			/>
			<p
				v-if="hiddenMessageLabel"
				class="line-clamp-1"
			>
				{{ hiddenMessageLabel }}
			</p>
			<p
				v-else
				class="line-clamp-1"
			>
				{{ snippetText }}
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

	// Composables
	import { useMentionsDisplay } from '@hub-client/composables/mention-display.composable';
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Models
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		eventId: string;
		// Whether or not to show the text "In reply to:" inside the snippet.
		showInReplyTo?: boolean;
		room: Room;
		hiddenMessageLabel?: string;
	};

	const props = withDefaults(defineProps<Props>(), {
		showInReplyTo: false,
		hiddenMessageLabel: '',
	});
	const { color, textColor } = useUserColor();
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const { t } = useI18n();

	// Refetched on edits: the snippet may be rendered before the edit of the replied-to message is applied
	const event = ref(await pubhubs.getEvent(props.room.roomId, props.eventId));

	const userColor = computed(() => color(event.value.sender ?? '') || 0);
	const text = computed(() => {
		return event.value.content?.body as string;
	});

	const redactedMessage = computed(() => {
		const isDeletedEvent = event.value.event_id && props.room.isDeletedEvent(event.value.event_id);
		const containsRedactedBecause = event.value.unsigned?.redacted_because !== undefined;
		return isDeletedEvent || containsRedactedBecause;
	});

	const snippetText = computed(() => {
		return redactedMessage.value ? t('message.delete.original_message_deleted') : useMentionsDisplay().formatMentions(text.value);
	});

	watch([() => props.eventId, () => props.room.editsRevision.count], async () => {
		event.value = await pubhubs.getEvent(props.room.roomId, props.eventId);
	});
</script>
