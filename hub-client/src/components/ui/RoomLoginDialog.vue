<template>
	<Teleport to="body">
		<Dialog
			v-if="props.dialogOpen"
			:allow-overflow="true"
			:buttons="props.secured ? buttonsCancel : buttonsYesNo"
			:title="t(title)"
			@close="handleClose"
		>
			<P class="text-wrap">
				{{ t(message, messageValues) }}
			</P>

			<div
				v-if="props.secured && requiredAttributes.length > 0"
				class="my-4 flex flex-wrap gap-3"
			>
				<Chip
					v-for="attr in requiredAttributes"
					:key="attr"
				>
					{{ attr }}
				</Chip>
			</div>
			<P
				v-if="roomDescription"
				class="my-4"
			>
				{{ roomDescription }}
			</P>

			<SecuredRoomLogin
				v-if="props.secured"
				class="relative left-1/2 mb-24 w-max -translate-x-1/2 transform"
				:secured-room-id="props.dialogOpen"
				:show-close="false"
				@success="handleClose"
			/>
		</Dialog>
	</Teleport>
</template>

<script lang="ts" setup>
	// Vue
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Chip from '@hub-client/components/elements/Chip.vue';
	import P from '@hub-client/components/elements/P.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import SecuredRoomLogin from '@hub-client/components/ui/SecuredRoomLogin.vue';

	// Stores
	import { buttonsCancel, buttonsYesNo } from '@hub-client/stores/dialog';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useYivi } from '@hub-client/stores/yivi';

	// Props
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
	const rooms = useRooms();
	const yiviStore = useYivi();

	const roomDescription = computed(() => {
		if (!props.dialogOpen) return '';
		const room = rooms.securedRoomById(props.dialogOpen);
		return room?.user_txt ?? '';
	});

	const requiredAttributes = computed(() => {
		if (!props.dialogOpen) return [];
		const room = rooms.securedRoomById(props.dialogOpen);
		const accepted = room?.accepted;
		if (!accepted) return [];
		const attrKeys = Object.keys(accepted);
		const yiviAttrs = yiviStore.getAttributes(t);
		return attrKeys.map((key) => {
			const found = yiviAttrs.find((a) => a.attribute === key);
			return found ? found.label : key;
		});
	});

	async function handleClose() {
		emit('update:dialogOpen', null);
		emit('close');
	}
</script>
