<template>
	<!-- Temporary fix to set all text in the dialog to black until the dialog changes theme -->
	<Dialog class="text-black" :title="$t('roomlibrary.delete.heading')" :buttons="buttonsYesNo" @close="close($event)" width="max-w-full lg:max-w-[40%] min-w-[92.5%] lg:min-w-[22.5%]">
		<div>
			<p>{{ $t('roomlibrary.delete.content', [props.eventContent.filename]) }}</p>
			<p class="font-bold">{{ $t('roomlibrary.delete.warning') }}</p>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
	// Components
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Models
	import { TFileMessageEventContent, TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { DialogButtonAction, buttonsYesNo } from '@hub-client/stores/dialog';

	const emit = defineEmits<{
		yes: [];
		close: [];
	}>();

	const props = defineProps<{
		eventContent: TFileMessageEventContent | TImageMessageEventContent;
	}>();

	async function close(returnValue: DialogButtonAction) {
		if (returnValue === 1) {
			emit('yes');
		}
		emit('close');
	}
</script>
