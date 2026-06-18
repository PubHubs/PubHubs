<template>
	<Dialog
		:title="$t('message.delete.heading')"
		:width="isMobile ? 'px-400 w-full' : 'w-[600px] px-400'"
		class="z-50"
		@close="close()"
	>
		<ValidatedForm
			v-slot="{ isValidated }"
			class="flex flex-col gap-200 p-200"
			@submit.prevent
		>
			<div v-if="!user.isAdmin && (event.content.msgtype === MsgType.File || event.content.msgtype === MsgType.Image)">
				<p class="font-bold">
					{{ $t('message.delete.beware') }}
				</p>
				<p class="font-bold">
					{{ $t('message.delete.file_not_deleted') }}
				</p>
			</div>

			<Suspense>
				<Mask>
					<RoomMessageBubble
						class="room-event"
						:delete-message-dialog="true"
						:event="event"
						:room="room"
						:show-actions="false"
						:view-from-thread="props.viewFromThread"
					/>
					<Reaction
						v-if="displayReactionInDialog(event.event_id)"
						class="mx-200 w-5/6"
						:message-event-id="event.event_id"
						:react-event="displayReactionInDialog(event.event_id) ?? []"
					/>
				</Mask>
				<template #fallback>
					<p>{{ $t('state.loading_message') }}</p>
				</template>
			</Suspense>

			<!-- Input reason for stewards deleting someone else's message -->
			<TextArea
				v-if="isStewardDeletingOthersMessage"
				v-model="reason"
				:validation="{ required: true, maxLength: 500 }"
				@keydown.esc.stop
			>
				{{ $t('message.delete.reason_label') }}
			</TextArea>

			<ButtonGroup>
				<Button
					variant="error"
					@click.stop.prevent="close()"
				>
					{{ $t('dialog.cancel') }}
				</Button>
				<Button
					type="submit"
					:disabled="isStewardDeletingOthersMessage && !isValidated"
					@click.stop.prevent="onSubmit()"
				>
					{{ $t('dialog.submit') }}
				</Button>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { type MatrixEvent, MsgType } from 'matrix-js-sdk';
	import { type PropType, computed, ref } from 'vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import TextArea from '@hub-client/components/forms/elements/TextArea.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	// Components
	import Mask from '@hub-client/components/ui/Mask.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';

	// Models
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { type Room } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps({
		event: {
			type: Object as PropType<TMessageEvent>,
			required: true,
		},
		room: {
			type: Object as PropType<InstanceType<typeof Room>>,
			required: true,
		},
		viewFromThread: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits<{
		close: [];
		yes: [reason?: string];
	}>();

	const settings = useSettings();
	const user = useUser();

	const isMobile = computed(() => settings.isMobileState);
	const reason = ref('');
	const isStewardDeletingOthersMessage = computed(() => props.event.sender !== user.userId);

	function displayReactionInDialog(eventId: string): MatrixEvent[] | undefined {
		return props.room.getRelatedEvents(eventId).map((x) => x.matrixEvent);
	}

	function close() {
		emit('close');
	}

	function onSubmit() {
		emit('yes', isStewardDeletingOthersMessage.value ? reason.value : undefined);
		close();
	}
</script>
