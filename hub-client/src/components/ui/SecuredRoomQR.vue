<template>
	<div
		id="yivi-login"
		ref="yivi-login-ref"
		class="w-[255px] after:absolute after:-top-[1.2em] after:left-[50%] after:border-[1.25em] after:border-r-0 after:border-t-0 after:border-transparent after:border-b-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
	></div>
</template>

<script setup lang="ts">
	import { SecuredRoomAttributeResult } from '@/logic/foundation/statusTypes';
	import { useRouter } from 'vue-router';
	import { useRooms } from '@/logic/store/rooms';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { onMounted } from 'vue';

	const props = defineProps<{ securedRoomId: string }>();

	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const router = useRouter();

	onMounted(() => rooms.yiviSecuredRoomflow(props.securedRoomId, resultOfEntry));

	const emit = defineEmits<{ (e: 'error', message: string): void }>();

	function resultOfEntry(result: SecuredRoomAttributeResult) {
		if (result.goto) {
			pubhubs.updateRooms().then(() => router.push({ name: 'room', params: { id: props.securedRoomId } }));
		} else if (result.not_correct) {
			emit('error', result.not_correct);
		}
	}

	// START workaround for #1173, that iOS app links do not work in an iframe.
	//
	// NOTE: Please remove when e.g. https://github.com/privacybydesign/yivi-frontend-packages/pull/34 is merged
	//
	// Idea: we wait for the "Open Yivi app" anchor <a class="yivi-web-button-link" ...>
	//       to be created using a MutationObserver, and add target="_top" attribute to it.
	//
	import { useTemplateRef, watch, onWatcherCleanup } from 'vue';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';

	const yiviLoginRef = useTemplateRef('yivi-login-ref');

	function onYiviNodeChange() {
		LOGGER.trace(SMI.OTHER, "Changes to Yivi div's subtree");

		const yiviAnchor: Node | undefined = yiviLoginRef.value.querySelector('.yivi-web-button-link');

		if (!yiviAnchor) {
			LOGGER.trace(SMI.OTHER, "Yivi div changed, but no 'Open Yivi app' anchor was found.");
			return;
		}

		if (!yiviAnchor.hasAttribute('href')) {
			LOGGER.trace(SMI.OTHER, "'Open Yivi app' has no href attribute (yet)");
			return;
		}

		if (yiviAnchor.getAttribute('href').startsWith('intent')) {
			LOGGER.trace(SMI.OTHER, "'Open Yivi app' button uses intent link, so this is not iOS: not changing target");
			return;
		}

		if (yiviAnchor.hasAttribute('target')) {
			LOGGER.trace(SMI.OTHER, "'Open Yivi app' anchor's target was already set.");
			return;
		}

		LOGGER.info(SMI.OTHER, 'Setting target="_top" on \'Open Yivi app\' anchor.');
		yiviAnchor.setAttribute('target', '_top');
	}

	watch(yiviLoginRef, (yiviLoginEl) => {
		LOGGER.trace(SMI.OTHER, 'The Yivi div itself changed');

		// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
		const mutationObserver = new MutationObserver(onYiviNodeChange);

		LOGGER.trace(SMI.OTHER, 'Connecting  MutationObserver to Yivi div for observing changes to its subtree');
		mutationObserver.observe(yiviLoginEl, {
			childList: true,
			subtree: true,
		});

		onWatcherCleanup(() => {
			LOGGER.trace(SMI.OTHER, 'Disconnecting Yivi div MutationObserver');
			mutationObserver.disconnect();
		});
	});
	// END workaround
</script>
