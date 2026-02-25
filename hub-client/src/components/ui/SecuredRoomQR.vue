<template>
	<div
		:id="EYiviFlow.SecuredRoom"
		ref="yivi-login-ref"
		class="w-[255px] after:absolute after:-top-[1.2em] after:left-[50%] after:border-[1.25em] after:border-t-0 after:border-r-0 after:border-transparent after:border-b-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
	></div>
</template>

<!-- FIXME: Multiple type errors -->
<script setup lang="ts">
	// Packages
	import { onMounted, useTemplateRef } from 'vue';
	import { useRouter } from 'vue-router';

	import { useYiviIosWorkaround } from '@hub-client/composables/yiviIosWorkaround.composable';

	// Logic
	import { SecuredRoomAttributeResult } from '@hub-client/logic/logging/statusTypes';
	import { yiviFlow } from '@hub-client/logic/yiviHandler';

	// Model
	import { EYiviFlow } from '@hub-client/models/yivi/Tyivi';

	import { useNotifications } from '@hub-client/stores/notifications';
	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const pubhubs = usePubhubsStore();
	const router = useRouter();
	const notificationsStore = useNotifications();

	const props = defineProps<{ securedRoomId: string }>();

	onMounted(() => yiviFlow(EYiviFlow.SecuredRoom, resultOfEntry, props.securedRoomId, '#' + EYiviFlow.SecuredRoom));

	const emit = defineEmits<{
		(e: 'error', message: string): void;
		(e: 'success'): void;
	}>();

	function resultOfEntry(result: SecuredRoomAttributeResult) {
		if (result.goto) {
			pubhubs.joinRoom(props.securedRoomId).then(() => {
				router.push({ name: 'room', params: { id: props.securedRoomId } });
			});
			notificationsStore.removeNotification(props.securedRoomId);
			emit('success');
		} else if (result && result.not_correct) {
			emit('error', result.not_correct);
		}
	}

	// START workaround for #1173, that iOS app links do not work in an iframe.
	const yiviLoginRef = useTemplateRef('yivi-login-ref');
	useYiviIosWorkaround(yiviLoginRef);
	// END workaround
</script>
