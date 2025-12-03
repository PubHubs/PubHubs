<template>
	<Teleport to="body">
		<Dialog v-if="props.dialogOpen" @close="handleClose" :title="t(title)" :buttons="buttonsYesNo" :allowOverflow="true">
			<P class="text-label-small-min/label-small-max text-wrap">
				{{ t(message, messageValues) }}
			</P>

			<SecuredRoomLogin v-if="props.secured" :securedRoomId="props.dialogOpen" :showClose="false" @click="handleClose" class="relative left-1/2 mb-24 w-max -translate-x-1/2 transform" />
		</Dialog>
	</Teleport>
</template>

<script setup lang="ts">
	// Vue
	import { useI18n } from 'vue-i18n';

	import P from '@hub-client/components/elements/P.vue';
	// Components
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import SecuredRoomLogin from '@hub-client/components/ui/SecuredRoomLogin.vue';

	import { router } from '@hub-client/logic/core/router';

	// Logic
	import { DialogButtonAction, buttonsYesNo } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const pubhubs = usePubhubsStore();

	const props = defineProps<{
		dialogOpen: string | null;
		title: string;
		message: string;
		messageValues: (string | number)[];
		secured?: boolean;
	}>();

	const emit = defineEmits<{
		(e: 'update:dialogOpen', value: string | null): void;
		(e: 'close'): void;
		(e: 'yes'): void;
	}>();

	const { t } = useI18n();

	async function handleClose(returnValue: DialogButtonAction) {
		if (returnValue === 1 && props.dialogOpen) {
			await join(props.dialogOpen);
		}
		emit('update:dialogOpen', null);
		emit('close');
	}
	async function join(roomId: string) {
		await pubhubs.joinRoom(roomId);
		await router.push({ name: 'room', params: { id: roomId } });
	}
</script>
