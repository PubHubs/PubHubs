<template>
	<div class="absolute top-16 flex flex-col text-center">
		<!-- Popup Container -->
		<div class="z-20 box-border h-fit w-[255px] rounded-lg bg-white p-0 drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]">
			<!-- Close Button Inside the Popup (Top-Right) -->
			<IconButton
				v-if="showClose"
				class="absolute top-2 right-2 z-10 p-2 text-black"
				size="base"
				type="x"
				@click="closePopOver"
			/>
			<QRCode
				v-if="!loginFail"
				:secured-room-id="securedRoomId"
				@error="loginError"
				@success="emit('success')"
			/>
			<!-- Overlay when login fails -->
			<div v-if="loginFail">
				<div class="my-24 flex flex-col items-center justify-center gap-4">
					<Icon
						class="text-avatar-red"
						size="xl"
						type="prohibit"
					/>
					<P class="text-body ml-2 text-center text-black">
						{{ t('rooms.incorrect_attributes') }}
					</P>
					<Button
						size="sm"
						@click="retry()"
					>
						{{ t('rooms.retry') }}
					</Button>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import P from '@hub-client/components/elements/P.vue';
	import QRCode from '@hub-client/components/ui/SecuredRoomQR.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	const props = defineProps({
		securedRoomId: {
			type: String,
			required: true,
		},
		showClose: {
			type: Boolean,
			default: true,
		},
	});
	const emit = defineEmits(['success']);
	const rooms = useRooms();
	const { t } = useI18n();
	const loginFail = ref(false);

	onMounted(async () => await rooms.getSecuredRoomInfo(props.securedRoomId));

	function closePopOver() {
		emit('success');
	}
	function retry() {
		loginFail.value = false;
	}

	function loginError(error: string) {
		if (error) loginFail.value = true;
	}
</script>
