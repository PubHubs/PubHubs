<template>
	<div
		:id="EYiviFlow.SecuredRoom"
		ref="yivi-login-ref"
		class="w-[255px] after:absolute after:-top-[1.2em] after:left-[50%] after:border-[1.25em] after:border-t-0 after:border-r-0 after:border-transparent after:border-b-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
	/>
</template>

<!-- FIXME: Multiple type errors -->
<script lang="ts" setup>
	// Packages
	import { onMounted, useTemplateRef } from 'vue';
	import { useRouter } from 'vue-router';

	import { useYiviIosWorkaround } from '@hub-client/composables/yiviIosWorkaround.composable';

	import { yiviFlow } from '@hub-client/logic/yiviHandler';

	import { type YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	// Model
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
	// Logic
	import { type SecuredRoomAttributeResult } from '@hub-client/models/yivi/Tyivi';
	import { EYiviFlow } from '@hub-client/models/yivi/Tyivi';

	import { useNotifications } from '@hub-client/stores/notifications';
	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const props = defineProps<{ securedRoomId: string }>();
	const emit = defineEmits<{
		(e: 'error', message: string): void;
		(e: 'success'): void;
	}>();
	const pubhubs = usePubhubsStore();
	const router = useRouter();
	const notificationsStore = useNotifications();

	onMounted(() => yiviFlow(EYiviFlow.SecuredRoom, resultOfEntry, props.securedRoomId, '#' + EYiviFlow.SecuredRoom));

	function resultOfEntry(result: YiviSigningSessionResult | SecuredRoomAttributeResult) {
		const typedResult = result as SecuredRoomAttributeResult;
		if (typedResult.goto) {
			pubhubs.joinRoom(props.securedRoomId, RoomType.PH_MESSAGES_RESTRICTED).then(() => {
				router.push({ name: 'room', params: { id: props.securedRoomId } });
			});
			notificationsStore.removeNotification(props.securedRoomId);
			emit('success');
		} else if (typedResult && typedResult.not_correct) {
			emit('error', typedResult.not_correct);
		}
	}

	// START workaround for #1173, that iOS app links do not work in an iframe.
	const yiviLoginRef = useTemplateRef('yivi-login-ref');
	useYiviIosWorkaround(yiviLoginRef);
	// END workaround
</script>
