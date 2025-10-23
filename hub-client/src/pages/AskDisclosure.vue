<template>
	<AskDisclosureAttrsForm v-if="showAskDisclosureAttrsForm" :askDisclosure="rooms.askDisclosure" @submit="onSubmit" @choose-user="onChooseUser" @close="onCloseAskDisclosureAttrsForm" />

	<ChooseFromUsersList v-if="showChooseFromUsersList" :header="$t('admin.ask_disclosure_choose_user')" @chosen-user="onChosenUser" @close="onCloseChooseFromUsersList" />
</template>

<script setup lang="ts">
	// Packages
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute } from 'vue-router';

	// Components
	import AskDisclosureAttrsForm from '@hub-client/components/rooms/AskDisclosureAttrsForm.vue';
	import ChooseFromUsersList from '@hub-client/components/rooms/ChooseFromUsersList.vue';

	// Models
	import { AskDisclosure, AskDisclosureMessage, DisclosureAttribute } from '@hub-client/models/components/signedMessages';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	const route = useRoute();
	const { t } = useI18n();
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const emit = defineEmits(['close']);
	const showAskDisclosureAttrsForm = ref(true);
	const showChooseFromUsersList = ref(false);

	onBeforeMount(async () => {
		// Defaults (for testing)
		let ask: AskDisclosure = {
			user: { userId: '' },
			message: t('admin.ask_disclosure_message_placeholder'),
			attributes: [
				{ yivi: 'irma-demo.sidn-pbdf.email.domain', values: 'email domain' },
				{ yivi: 'irma-demo.sidn-pbdf.email.email', values: 'email address' },
			],
			where_room: '',
		};
		// Params supplied
		// Param 'user': look up by userId; will be null if not known
		const user_found = typeof route.query.user === 'string' ? pubhubs.client.getUser(route.query.user) : null;
		// Initialise from defaults and params
		if (user_found) {
			ask.user = {
				userId: user_found.userId,
				displayName: user_found.displayName,
			};
		}
		rooms.askDisclosure = ask;
	});

	async function onSubmit(result: AskDisclosure) {
		console.debug(`AskDisclosure:onSubmit: u=${result.user?.userId}, m=${result.message}, a=[${result.attributes?.map((a: any) => a.yivi)}]`);
		const attributeNames = result.attributes.map((a: DisclosureAttribute) => a.yivi);
		console.debug(`AskDisclosure:onSubmit: attributeNames=[${attributeNames}]`);

		// Get a private room with recipient
		const privateRoom = await pubhubs.createPrivateRoomWith(result.user);
		const privateRoomId = privateRoom!.room_id; // asserting createPrivateRoomWith() in fact always returns non-null

		// Tell the recipient what is required
		const messageToRecipient = t('admin.ask_disclosure_message_to_recipient', [result.user?.userId, result.message, attributeNames]);
		console.debug(`AskDisclosure: to ${result.user?.userId} in ${privateRoomId}: "${messageToRecipient}"`);
		const ask: AskDisclosureMessage = {
			userId: result.user?.userId,
			replyToRoomId: result.where_room || privateRoomId,
			message: messageToRecipient,
			attributes: result.attributes,
		};
		// Message is duplicated in body and in 'ask' object.
		await pubhubs.addAskDisclosureMessage(privateRoomId, messageToRecipient, ask);
	}

	function onChooseUser(result: AskDisclosure) {
		console.debug(`AskDisclosure:onChooseUser: u=${result.user?.userId}, m=${result.message}, a=[${result.attributes?.map((a: any) => a.yivi)}]`);
		showAskDisclosureAttrsForm.value = false;
		rooms.askDisclosure = result;
		showChooseFromUsersList.value = true;
	}

	function onChosenUser(other: MatrixUser) {
		showChooseFromUsersList.value = false;
		rooms.askDisclosure!.user = {
			userId: other.userId,
			displayName: other.displayName,
		};
		showAskDisclosureAttrsForm.value = true;
	}

	function onCloseAskDisclosureAttrsForm() {
		showAskDisclosureAttrsForm.value = false;
		showChooseFromUsersList.value = false;
		emit('close');
	}

	function onCloseChooseFromUsersList() {
		showChooseFromUsersList.value = false;
		showAskDisclosureAttrsForm.value = true;
	}
</script>
