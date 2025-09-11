<template>
	<Dialog :title="$t('message.delete.heading')" :buttons="buttonsYesNo" @close="close($event)" width="max-w-full lg:max-w-[40%] min-w-[92.5%] lg:min-w-[22.5%]">
		<div v-if="!user.isAdmin && (event.content.msgtype === MsgType.File || event.content.msgtype === MsgType.Image)">
			<p class="font-bold">{{ $t('message.delete.beware') }}</p>
			<p class="mb-4 font-bold">{{ $t('message.delete.file_not_deleted') }}</p>
		</div>
		<Suspense>
			<Mask>
				<RoomMessageBubble class="w-fit" :event="event" :room="room" :deleteMessageDialog="true" :viewFromThread="props.viewFromThread" />
				<Reaction class="mx-4 w-5/6" v-if="displayReactionInDialog(event.event_id)" :reactEvent="displayReactionInDialog(event.event_id)" :messageEventId="event.event_id" />
			</Mask>
			<template #fallback>
				<p>{{ $t('state.loading_message') }}</p>
			</template>
		</Suspense>
	</Dialog>
</template>

<script setup lang="ts">
	import Room from '@/pages/Room.vue';
	import { buttonsYesNo, DialogButtonAction } from '@/logic/store/dialog';
	import { useUser } from '@/logic/store/user';
	import { PropType } from 'vue';

	const user = useUser();

	// Components

	import Dialog from '../ui/Dialog.vue';
	import Reaction from '../ui/Reaction.vue';
	import RoomMessageBubble from '../rooms/RoomMessageBubble.vue';

	import { RelationType } from '@/model/constants';
	import { MatrixEvent, MsgType } from 'matrix-js-sdk';

	const emit = defineEmits(['yes', 'close']);

	const props = defineProps({
		event: {
			type: Object,
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

	function displayReactionInDialog(eventId: string): MatrixEvent {
		if (!props.threadReactionEvent) {
			return props.room.getReactionEvent(eventId);
		} else {
			return props.threadReactionEvent.filter((reactEvent: MatrixEvent) => reactEvent.getContent()[RelationType.RelatesTo]?.event_id === eventId);
		}
	}

	async function close(returnValue: DialogButtonAction) {
		if (returnValue === 1) {
			emit('yes');
		}
		emit('close');
	}
</script>
