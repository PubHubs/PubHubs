<template>
	<Dialog :title="$t('message.delete.heading')" :buttons="buttonsYesNo" @close="close($event)" width="max-w-full lg:max-w-[40%] min-w-[92.5%] lg:min-w-[22.5%]">
		<div v-if="!user.isAdmin && (event.content.msgtype === MsgType.File || event.content.msgtype === MsgType.Image)">
			<p class="font-bold">{{ $t('message.delete.beware') }}</p>
			<p class="mb-4 font-bold">{{ $t('message.delete.file_not_deleted') }}</p>
		</div>
		<Suspense>
			<Mask>
				<RoomMessageBubble :event="event" :room="room" :deleteMessageDialog="true" :viewFromThread="props.viewFromThread" />
				<Reaction class="mx-4 w-5/6" v-if="displayReactionInDialog(event.event_id)" :reactEvent="displayReactionInDialog(event.event_id)" :messageEventId="event.event_id" />
			</Mask>
			<template #fallback>
				<p>{{ $t('state.loading_message') }}</p>
			</template>
		</Suspense>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import Reaction from '../ui/Reaction.vue';
	import { MatrixEvent, MsgType } from 'matrix-js-sdk';
	import { PropType } from 'vue';

	// Components
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	import { RelationType } from '@hub-client/models/constants';

	// Pages

	// Stores
	import { DialogButtonAction, buttonsYesNo } from '@hub-client/stores/dialog';
	import { Room } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const user = useUser();
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
