<template>
	<div class="absolute top-16 flex flex-col text-center">
		<!-- Popup Container -->
		<div class="z-20 box-border min-h-[333px] w-[255px] rounded-lg bg-white p-0 drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]">
			<!-- Close Button Inside the Popup (Top-Right) -->
			<IconButton v-if="showClose" type="x" size="base" class="absolute top-2 right-2 z-10 p-2 dark:text-black" @click="closePopOver" />
			<QRCode v-if="!loginFail" :securedRoomId="securedRoomId" @error="loginError" @success="emit('success')" />
			<!-- Overlay when login fails -->
			<div v-if="loginFail" class="absolute inset-0 z-5 rounded-lg bg-white">
				<div class="my-24 flex flex-col items-center justify-center gap-4">
					<Icon class="text-avatar-red" type="prohibit" size="xl" />
					<P class="text-body ml-2 text-center dark:text-black">{{ t('rooms.incorrect_attributes') }}</P>
					<Button @click="retry()" size="sm">{{ t('rooms.retry') }}</Button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import QRCode from '@hub-client/components/ui/SecuredRoomQR.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();
	const { t } = useI18n();
	const emit = defineEmits(['success']);
	const loginFail = ref(false);

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
