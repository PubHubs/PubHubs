<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<!-- Deleted Message -->
		<Icon v-if="deleted" type="trash" size="sm" />
		<p v-if="deleted" class="text-on-surface-dim overflow-hidden text-ellipsis">
			{{ t('message.delete.message_deleted') }}
		</p>

		<!-- Message with Mentions -->
		<div v-else-if="hasAnyMentions" class="relative max-w-[90ch] text-ellipsis">
			<P v-for="segment in messageSegments" :key="segment" class="inline">
				<!-- Normal text segment -->
				<span v-if="segment.type === 'text'">{{ segment.content }}</span>

				<span v-else-if="segment.type === 'user' || segment.type === 'room'" @mouseover="activeMentionCard = segment.id" @mouseleave="activeMentionCard = null" class="relative">
					<!-- Segment with token -->
					<span class="text-accent-primary">{{ segment.displayName }}</span>
					<!-- Pop up when hovering over mention -->
					<div v-if="activeMentionCard === segment.id && segment.tokenId" class="test absolute top-full left-0 z-50 w-52" :class="segment.type === 'user' ? 'h-40' : 'h-10'">
						<ProfileCard v-if="segment.type === 'user'" :event="event" :userId="segment.tokenId" />
						<RoomMiniCard v-else :roomId="segment.tokenId" />
					</div>
				</span>
			</P>
		</div>

		<!-- Regular Message -->
		<p v-else v-html="messageContent" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomMiniCard from '@hub-client/components/rooms/RoomMiniCard.vue';
	import ProfileCard from '@hub-client/components/ui/ProfileCard.vue';

	import { useMentions } from '@hub-client/composables/useMentions';

	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	const { t } = useI18n();
	const props = defineProps<{
		event: TMessageEvent;
		deleted: boolean;
	}>();

	const activeMentionCard = ref<string | null>(null);
	const mentionComposable = useMentions();

	// Regular message content (for non-deleted, non-mention messages)
	const messageContent = computed(() => {
		return props.event.content.ph_body;
	});

	/**
	 * Parse message body into segments with mentions replaced by displayName
	 */
	const messageSegments = computed(() => {
		if (props.deleted) return [];

		const body = props.event.content.body || '';
		const mentions = mentionComposable.parseMentions(body);

		return mentionComposable.buildSegments(body, mentions);
	});

	const hasAnyMentions = computed(() => {
		return messageSegments.value.some((seg) => seg.type !== 'text');
	});
</script>
