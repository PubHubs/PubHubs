<template>
	<Dialog
		:buttons="buttonsYesNo"
		:title="$t('message.delete.heading')"
		width="max-w-full lg:max-w-[40%] min-w-[92.5%] lg:min-w-[22.5%]"
		@close="close($event)"
	>
		<div v-if="!user.isAdmin && (event.content.msgtype === MsgType.File || event.content.msgtype === MsgType.Image)">
			<p class="font-bold">
				{{ $t('message.delete.beware') }}
			</p>
			<p class="mb-4 font-bold">
				{{ $t('message.delete.file_not_deleted') }}
			</p>
		</div>
		<Suspense>
			<Mask>
				<RoomMessageBubble
					:delete-message-dialog="true"
					:event="event"
					:room="room"
					:view-from-thread="props.viewFromThread"
				/>
				<Reaction
					v-if="displayReactionInDialog(event.event_id)"
					class="mx-4 w-5/6"
					:message-event-id="event.event_id"
					:react-event="displayReactionInDialog(event.event_id) ?? []"
				/>
			</Mask>
			<template #fallback>
				<p>{{ $t('state.loading_message') }}</p>
			</template>
		</Suspense>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import Reaction from '../ui/Reaction.vue';
	import { type MatrixEvent, MsgType } from 'matrix-js-sdk';
	import { type PropType } from 'vue';

	// Components
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { type DialogButtonAction, buttonsYesNo } from '@hub-client/stores/dialog';
	import { type Room } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps({
		event: {
			type: Object as PropType<TMessageEvent>,
			required: true,
		},
		threadReactionEvent: {
			type: Object,
			default: null,
		},
		viewFromThread: {
			type: Boolean,
			default: false,
		},
		room: {
			type: Object as PropType<InstanceType<typeof Room>>,
			required: true,
		},
	});
	const emit = defineEmits(['yes', 'close']);
	const user = useUser();
	function displayReactionInDialog(eventId: string): MatrixEvent[] | undefined {
		return props.room.getRelatedEvents(eventId).map((x) => x.matrixEvent);
	}

	async function close(returnValue: DialogButtonAction) {
		if (returnValue === 1) {
			emit('yes');
		}
		emit('close');
	}
</script>
