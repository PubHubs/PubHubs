<template>
	<div class="flex flex-col gap-2">
		<P> {{ discosureRequest.message }} </P>
		<div class="bg-surface flex h-full items-center justify-evenly gap-x-4 rounded-2xl border p-4" :class="!isMobile ? 'max-w-[700px] flex-row px-12' : 'w-full flex-col'">
			<div class="flex w-full flex-col gap-2">
				<H3>{{ t('admin.disclosure_dialog_title') }}</H3>
				<P class="text-body-small"> {{ t('admin.disclosure_message', [roomName]) }} </P>
				<div class="flex flex-row items-center gap-2 rounded-lg border bg-white p-4 text-black">
					<img class="h-[1.75rem]" src="@hub-client/assets/yivi-logo.svg" alt="Yivi" />
					<P>{{ attributeTranslations }}</P>
				</div>
			</div>

			<div class="flex h-full w-full items-center justify-center">
				<div v-if="disclosed" class="scale-75" :id="props.event.event_id.replace(/[^a-zA-Z ]/g, '')"></div>
				<div v-else class="m-8 flex h-[211.5px] w-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl bg-white text-black" @click="startDisclosure">
					<icon type="qr-code" size="2xl"> </icon>
					<P>{{ t('admin.disclose') }}</P>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, nextTick, ref, toRaw } from 'vue';
	import { useI18n } from 'vue-i18n';

	import { yiviFlow } from '@hub-client/logic/yiviHandler';

	import { AskDisclosureMessage, YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { EYiviFlow } from '@hub-client/models/yivi/Tyivi';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	const props = defineProps<{ event: TMessageEvent }>();

	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	if (!('ask_disclosure_message' in props.event.content)) {
		throw new Error('Invalid message content was given in the disclosure message');
	}
	const disclosure = props.event.content.ask_disclosure_message as AskDisclosureMessage;
	const discosureRequest = structuredClone(toRaw(disclosure));

	const { t } = useI18n();
	let disclosed = ref<boolean>(false);
	const pubhubs = usePubhubsStore();
	const rooms = useRooms();

	const room = rooms.fetchRoomById(discosureRequest.replyToRoomId);
	let roomName;
	if (rooms.currentRoom?.roomId === room?.roomId) roomName = t('admin.this_room');
	else roomName = room?.name;

	const attributeClone = structuredClone(discosureRequest.attributes);
	const attributeTranslations = attributeClone
		.filter((attribute: string) => typeof attribute === 'string')
		.map((attribute) => t('attribute.' + attribute))
		.join(', ');

	async function startDisclosure() {
		disclosed.value = true;
		// Wait for Vue to update the DOM for id="yivi-disclosure"
		await nextTick();
		yiviFlow(EYiviFlow.Disclosure, finishDisclosure, discosureRequest.replyToRoomId!, '#' + props.event.event_id.replace(/[^a-zA-Z ]/g, ''), discosureRequest.attributes, t('admin.ask_disclosure_yivi_message'));
	}

	function finishDisclosure(result: YiviSigningSessionResult) {
		pubhubs.addDisclosedMessage(discosureRequest.replyToRoomId, result, undefined);
		disclosed.value = false;
	}
</script>
