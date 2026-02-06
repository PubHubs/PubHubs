<template>
	<Teleport to="body">
		<Dialog v-if="dialogOpen" @close="handleClose" :title="t(title)" :buttons="buttonsCancel" :allowOverflow="true">
			<P class="text-label-small-min/label-small-max text-wrap">
				{{ t(message, messageValues) }}
			</P>
			<SecuredRoomLogin :securedRoomId="dialogOpen" :showClose="false" @click="handleClose" class="relative left-1/2 mb-24 w-max -translate-x-1/2 transform" />
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
	import { buttonsCancel } from '@hub-client/stores/dialog';

	const props = defineProps<{
		dialogOpen: string | null;
		title: string;
		message: string;
		messageValues: (string | number)[];
	}>();

	const emit = defineEmits<{
		(e: 'update:dialogOpen', value: string | null): void;
		(e: 'close'): void;
	}>();

	const { t } = useI18n();

	function handleClose() {
		emit('update:dialogOpen', null);
		emit('close');
	}
</script>
