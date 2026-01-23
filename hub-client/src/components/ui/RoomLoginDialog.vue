<template>
	<Teleport to="body">
		<Dialog v-if="props.dialogOpen" @close="handleClose" :title="t(title)" :buttons="props.secured ? buttonsCancel : buttonsYesNo" :allowOverflow="true">
			<P class="text-label-small-min/label-small-max text-wrap">
				{{ t(message, messageValues) }}
			</P>

			<SecuredRoomLogin v-if="props.secured" :securedRoomId="props.dialogOpen" :showClose="false" @success="handleClose" class="relative left-1/2 mb-24 w-max -translate-x-1/2 transform" />
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

	// Logic
	import { DialogButtonAction, buttonsCancel, buttonsYesNo } from '@hub-client/stores/dialog';

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
	}>();

	const { t } = useI18n();

	async function handleClose(returnValue: DialogButtonAction) {
		emit('update:dialogOpen', null);
		emit('close');
	}
</script>
