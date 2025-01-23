<template>
	<!-- Temporary fix to set all text in the dialog to black until the dialog changes theme -->
	<Dialog class="text-black" :title="$t('message.delete.heading')" :buttons="buttonsYesNo" @close="close($event)" width="max-w-full lg:max-w-[40%] min-w-[92.5%] lg:min-w-[22.5%]">
		<div v-if="!user.isAdmin && (event.content.msgtype === 'm.file' || event.content.msgtype === 'm.image')">
			<p class="font-bold">{{ $t('message.delete.beware') }}</p>
			<p class="font-bold mb-4">{{ $t('message.delete.file_not_deleted') }}</p>
		</div>
		<Suspense>
			<RoomEvent class="w-fit" :event="event" :room="room" :deleteMessageDialog="true"></RoomEvent>
			<template #fallback>
				<p>{{ $t('state.loading_message') }}</p>
			</template>
		</Suspense>
	</Dialog>
</template>

<script setup lang="ts">
	// Components
	import Dialog from '../ui/Dialog.vue';

	import Room from '@/pages/Room.vue';
	import { buttonsYesNo, DialogButtonAction } from '@/store/dialog';
	import { useUser } from '@/store/user';

	const user = useUser();

	const emit = defineEmits(['yes', 'close']);

	defineProps({
		event: {
			type: Object,
			required: true,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	async function close(returnValue: DialogButtonAction) {
		if (returnValue === 1) {
			emit('yes');
		}
		emit('close');
	}
</script>
