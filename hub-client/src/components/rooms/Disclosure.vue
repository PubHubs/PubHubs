<template>
	<Dialog v-if="showDisclosureDialog" :title="$t('admin.disclosure_dialog_title')" :buttons="buttonsContinueIgnore" width="w-3/6" @close="closeDialog($event)">
		<p>The steward is asking you to disclose some information.</p>
		<p>Please use Yivi to reveal the following identity attribute(s).</p>
		<ul>
			<li v-for="(item, index) in rooms.askDisclosureMessage!.attributes" :key="index">
				{{ item.yivi }}
			</li>
		</ul>
		<p>To proceed, click 'Continue' and follow the Yivi instructions.</p>
		<p>TODO: Alternatively, please discuss this with the steward...</p>
	</Dialog>
	<DisclosureYivi v-if="showDisclosureYivi" :ask="rooms.askDisclosureMessage" @close="closeYivi" />
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';

	// Components
	import DisclosureYivi from '@hub-client/components/rooms/DisclosureYivi.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Stores
	import { DialogButton, DialogButtonAction, DialogCancel, DialogOk } from '@hub-client/stores/dialog';
	import { useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();
	const emit = defineEmits(['close']);
	const buttonsContinueIgnore: Array<DialogButton> = [new DialogButton('continue', 'blue', DialogOk), new DialogButton('ignore', 'red', DialogCancel)];

	const showDisclosureDialog = ref(false);
	const showDisclosureYivi = ref(false);

	// Present each 'askDisclosureMessage' to the user only once.
	// On receiving a new 'askDisclosureMessage' in the room state, start
	// the Yivi flow.
	rooms.$subscribe(async (mutation, state) => {
		if (!showDisclosureYivi.value && state.newAskDisclosureMessage) {
			console.debug(`Disclosure: start (ask={${state.askDisclosureMessage?.userId},...})`);
			showDisclosureDialog.value = true;
		}
	});

	// On close, reset 'newAskDisclosureMessage' so it's possible to receive another request later.
	function closeDialog(returnValue: DialogButtonAction) {
		showDisclosureDialog.value = false;
		if (returnValue === 1) {
			showDisclosureYivi.value = true;
		}
		emit('close');
	}

	function closeYivi() {
		showDisclosureYivi.value = false;
		rooms.newAskDisclosureMessage = false;
	}
</script>
