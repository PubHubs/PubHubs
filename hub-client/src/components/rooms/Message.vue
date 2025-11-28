<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<Icon v-if="deleted" type="trash" size="sm" />

		<!-- Deleted Message -->
		<p v-if="deleted" class="text-on-surface-dim overflow-hidden text-ellipsis">
			{{ t('message.delete.message_deleted') }}
		</p>

		<!-- Message with Mentions -->
		<div v-else-if="hasAnyMentions" class="relative max-w-[90ch] text-ellipsis">
			<component :is="'p'" v-for="(segment, index) in messageSegments" :key="index" class="inline">
				<template v-if="segment.type === 'text'">{{ segment.content }}</template>

				<span v-else-if="segment.type === 'room'" @mouseover="activeMentionCard = segment.id" @mouseleave="activeMentionCard = null" class="text-accent-primary relative cursor-pointer">
					{{ segment.displayName }}
					<div v-if="activeMentionCard === segment.id && segment.roomId" class="absolute top-full left-0 z-50 h-10 w-52" @mouseover="activeMentionCard = segment.id">
						<RoomMiniCard :roomId="segment.roomId" />
					</div>
				</span>

				<span v-else-if="segment.type === 'user'" @mouseover="activeMentionCard = segment.id" @mouseleave="activeMentionCard = null" class="text-accent-primary relative cursor-pointer">
					{{ segment.displayName }}
					<div v-if="activeMentionCard === segment.id && segment.userId" class="absolute top-full left-0 z-50 h-40 w-52" @mouseover="activeMentionCard = segment.id">
						<ProfileCard :event="event" :userId="segment.userId" />
					</div>
				</span>
			</component>
		</div>

		<!-- Regular Message (no mentions) -->
		<p v-else v-html="messageContent" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomMiniCard from '@hub-client/components/rooms/RoomMiniCard.vue';
	import ProfileCard from '@hub-client/components/ui/ProfileCard.vue';

	import { findAllMentions } from '@hub-client/logic/message';

	import { MessageSegment } from '@hub-client/models/components/TMessage';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	const { t } = useI18n();
	const props = defineProps<{
		event: TMessageEvent;
		deleted: boolean;
	}>();

	const activeMentionCard = ref<string | null>(null);

	// Regular message content (for non-deleted, non-mention messages)
	const messageContent = computed(() => {
		return props.event.content.ph_body;
	});

	/**
	 * Parse message body into segments with mentions replaced
	 */
	const messageSegments = computed((): MessageSegment[] => {
		if (props.deleted) return [];

		const body = props.event.content.body;
		if (!body) return [{ type: 'text', content: '', id: null }];

		const mentions = findAllMentions(body);
		if (mentions.length === 0) return [{ type: 'text', content: body, id: null }];

		const segments: MessageSegment[] = [];
		let lastIndex = 0;

		mentions.forEach((mention) => {
			// Add text before mention
			if (mention.start > lastIndex) {
				segments.push({
					type: 'text',
					content: body.substring(lastIndex, mention.start),
					id: null,
				});
			}

			// Add mention
			if (mention.type === 'room') {
				segments.push({
					type: 'room',
					displayName: mention.displayName,
					id: mention.id,
					roomId: mention.roomId,
				});
			} else {
				segments.push({
					type: 'user',
					displayName: mention.displayName,
					id: mention.id,
					userId: mention.userId,
				});
			}

			lastIndex = mention.end;
		});

		// Add remaining text
		if (lastIndex < body.length) {
			segments.push({
				type: 'text',
				content: body.substring(lastIndex),
				id: null,
			});
		}

		return segments;
	});

	const hasAnyMentions = computed(() => {
		if (props.deleted) return false;
		return messageSegments.value.some((seg) => seg.type !== 'text');
	});
</script>
