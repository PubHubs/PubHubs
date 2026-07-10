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
				class="my-200 flex flex-wrap gap-150"
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
				class="my-200"
			>
				{{ roomDescription }}
			</P>

			<SecuredRoomLogin
				v-if="props.secured"
				class="relative left-1/2 mb-1000 w-max -translate-x-1/2 transform"
				:secured-room-id="props.dialogOpen"
				:show-close="false"
				@success="handleClose"
			/>
		</Dialog>
	</Teleport>
</template>

<script lang="ts" setup>
	// Vue
	import { computed, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Chip from '@hub-client/components/elements/Chip.vue';
	import P from '@hub-client/components/elements/P.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import SecuredRoomLogin from '@hub-client/components/ui/SecuredRoomLogin.vue';

	// Composables
	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';

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
		(e: 'confirm'): void;
	}>();

	const { t } = useI18n();
	const rooms = useRooms();
	const yiviStore = useYivi();
	const { scrollToEnd } = useGlobalScroll();

	const roomDescription = computed(() => {
		if (!props.dialogOpen) return '';
		const room = rooms.publicSecuredRoomMetadataById(props.dialogOpen);
		return room?.topic ?? '-';
	});

	const requiredAttributes = computed(() => {
		if (!props.dialogOpen) return [];
		const room = rooms.publicSecuredRoomMetadataById(props.dialogOpen);
		const attrKeys = room?.accepted ?? [];
		const yiviAttrs = yiviStore.getAttributes(t);
		return attrKeys.map((key) => {
			const found = yiviAttrs.find((a) => a.attribute === key);
			return found ? found.label : key;
		});
	});

	// Fetch the public secured-room metadata whenever the dialog opens for a new room id.
	// IMPORTANT: don't remove this otherwise store will not fetch data which will be available for requireAttributes & roomDescription.
	watch(
		() => props.dialogOpen,
		(roomId) => {
			if (roomId && props.secured) {
				// On mobile the hub sits at the end of the horizontally scrolled layout; bring it
				// into view so this dialog is visible, mirroring the other dialog side-scroll triggers.
				scrollToEnd();
				rooms.getSecuredRoomPublicMetadata(roomId);
			}
		},
		{ immediate: true },
	);

	async function handleClose(action?: number) {
		emit('update:dialogOpen', null);
		emit('close');
		// action === 1 means "Yes" was clicked (for non-secured rooms)
		if (action === 1) {
			emit('confirm');
		}
	}
</script>
