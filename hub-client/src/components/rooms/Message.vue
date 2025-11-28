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

	import { MentionMatch, MessageSegment } from '@hub-client/models/components/TMessage';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

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

	const rooms = useRooms();
	const pubhubs = usePubhubsStore();

	/**
	 * Find all mentions (for both room and user) in the message body
	 */
	function findAllMentions(body: string): MentionMatch[] {
		if (!body) return [];

		const mentions: MentionMatch[] = [];

		// Find room mentions (#)
		let index = 0;
		while (index < body.length) {
			const hashIndex = body.indexOf('#', index);
			if (hashIndex === -1) break;

			// Find end of token (~ or space)
			const tilde = body.indexOf('~', hashIndex);
			const space = body.indexOf(' ', hashIndex);
			const endToken = tilde !== -1 && (space === -1 || tilde < space) ? tilde : space;
			const tokenEnd = endToken !== -1 ? endToken : body.length;

			// Extract room ID
			const nextSpace = body.indexOf(' ', tokenEnd + 1);
			const roomId = body.substring(tokenEnd + 1, nextSpace !== -1 ? nextSpace : body.length);

			const room = rooms.getTPublicRoom(roomId);
			if (room) {
				mentions.push({
					type: 'room',
					start: hashIndex,
					end: nextSpace !== -1 ? nextSpace : body.length,
					displayName: `#${room.name}`,
					id: `room-${roomId}-${hashIndex}`,
					roomId: roomId,
				});
				index = nextSpace !== -1 ? nextSpace : body.length;
			} else {
				index = hashIndex + 1;
			}
		}

		// Find user mentions (@)
		index = 0;
		while (index < body.length) {
			const atIndex = body.indexOf('@', index);
			if (atIndex === -1) break;

			// Find end of token (~ or space)
			const tilde = body.indexOf('~', atIndex);
			const space = body.indexOf(' ', atIndex);
			const endToken = tilde !== -1 && (space === -1 || tilde < space) ? tilde : space;
			const tokenEnd = endToken !== -1 ? endToken : body.length;

			const displayName = body.substring(atIndex, tokenEnd);

			// Extract user ID
			const nextSpace = body.indexOf(' ', tokenEnd + 1);
			const userId = body.substring(tokenEnd + 1, nextSpace !== -1 ? nextSpace : body.length);

			if (pubhubs.client.getUser(userId)) {
				mentions.push({
					type: 'user',
					start: atIndex,
					end: nextSpace !== -1 ? nextSpace : body.length,
					displayName: displayName,
					id: `user-${userId}-${atIndex}`,
					userId: userId,
				});
				index = nextSpace !== -1 ? nextSpace : body.length;
			} else {
				index = atIndex + 1;
			}
		}

		// Sort by start position
		return mentions.sort((a, b) => a.start - b.start);
	}

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
