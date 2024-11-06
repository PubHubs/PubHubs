<template>
	<!-- Temporary fix to set all text in the dialog to black until the dialog changes theme -->
	<Dialog class="text-black" :title="$t('message.delete.heading')" :buttons="buttonsYesNo" @close="close($event)" width="max-w-full lg:max-w-[40%] min-w-[92.5%] lg:min-w-[22.5%]">
		<p class="mb-4 whitespace-pre-line">{{ $t('message.delete.cannot_undo') }}</p>
		<Suspense>
			<RoomEvent class="w-fit" :event="props.event" :room="props.room" :deleteMessageDialog="true"></RoomEvent>
			<template #fallback>
				<p>{{ $t('state.loading_message') }}</p>
			</template>
		</Suspense>
	</Dialog>
</template>

<script setup lang="ts">
	import Room from '@/pages/Room.vue';
	import { buttonsYesNo, DialogButtonAction } from '@/store/dialog';

	const emit = defineEmits(['yes', 'close']);

	const props = defineProps({
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
