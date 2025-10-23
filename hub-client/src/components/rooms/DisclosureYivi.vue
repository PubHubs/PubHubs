<template>
	<!-- Yivi signing qr popup -->
	<div class="absolute bottom-[100px] left-60" id="yivi-web-form-2"></div>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Models
	import { AskDisclosureMessage, DisclosureAttribute, YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const emit = defineEmits(['close']);

	const props = defineProps<{
		ask: AskDisclosureMessage;
	}>();

	onMounted(() => {
		console.debug(`DisclosureYivi:onMounted(${props.ask.userId}, ${props.ask.message}, ${props.ask.attributes.map((a: any) => a.yivi)})`);
		const attributeNames = props.ask.attributes.map((a: DisclosureAttribute) => a.yivi);

		// start the signing (disclosure)
		const messageToSign = t('admin.disclosure_sign_message');
		startDisclosure(messageToSign, attributeNames);
	});

	function startDisclosure(message: string, attributes: string[]) {
		console.debug(`startDisclosure: m=${message}, a=[${attributes}]`);
		rooms.yiviAskDisclosure(message, attributes, rooms.currentRoomId, finishDisclosure);
	}

	function finishDisclosure(result: YiviSigningSessionResult) {
		console.debug(`finishDisclosure: type=${result.type}, status=${result.status}, proofStatus=${result.proofStatus}`);
		console.debug(`finishDisclosure: disclosed=${JSON.stringify(result.disclosed, null, 2)}`);
		if (result.status === 'DONE' && result.proofStatus === 'VALID') {
			for (const i of result.disclosed) {
				for (const j of i) {
					console.debug(`  disclosed: ${j.status} ${j.id} ${j.rawvalue}`);
				}
			}
		}
		// Post the disclosed attributes as a signed message
		pubhubs.addSignedMessage(props.ask.replyToRoomId, result);
		// TODO: Present the response to the moderator, and let them decide what to do with it.

		// clean up: close windows, reset state
		emit('close');
	}
</script>
