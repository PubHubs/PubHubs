<template>
	<div class="absolute top-16 flex flex-col text-center">
		<!-- Popup Container -->
		<div class="z-20 box-border min-h-[333px] w-[255px] rounded-lg bg-white p-0 drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]">
			<!-- Close Button Inside the Popup (Top-Right) -->
			<Icon type="closingCross" size="base" :asButton="true" class="absolute right-2 top-2 z-10 p-2 dark:text-black" @click="closePopOver"></Icon>
			<div
				v-if="!loginFlow"
				class="mx-4 my-12 flex flex-col gap-12 after:absolute after:-top-[1.2em] after:left-[50%] after:border-[1.25em] after:border-r-0 after:border-t-0 after:border-transparent after:border-b-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
			>
				<div class="flex flex-row items-center">
					<Icon type="lock" size="md"></Icon>
					<p class="ml-2 text-left text-sm dark:text-black">{{ t('rooms.secure_room_message') }}</p>
				</div>
				<p class="text-md max-h-24 w-full overflow-y-auto text-gray dark:text-gray-middle" :title="rooms.securedRoom.user_txt">{{ rooms.securedRoom.user_txt }}</p>
				<Button @click="showQR()" size="sm">{{ t('rooms.display_qr') }}</Button>
			</div>
			<QRCode v-if="loginFlow" :securedRoomId="securedRoomId" @error="loginError"></QRCode>
			<!-- Overlay when login fails -->
			<div v-if="loginFail" class="z-5 absolute inset-0 rounded-lg bg-white">
				<div class="my-24 flex flex-col items-center justify-center gap-4">
					<Icon class="text-avatar-red" type="slash" size="xl"></Icon>
					<p class="text-md ml-2 text-center dark:text-black">{{ t('rooms.incorrect_attributes') }}</p>
					<Button @click="retry()" size="sm">{{ t('rooms.retry') }}</Button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';

	import QRCode from './SecuredRoomQR.vue';

	import { useI18n } from 'vue-i18n';
	import { useRooms } from '@/logic/store/rooms';

	const rooms = useRooms();

	const { t } = useI18n();
	const emit = defineEmits(['click']);

	const loginFlow = ref(false);
	const loginFail = ref(false);

	const props = defineProps<{ securedRoomId: string }>();

	onMounted(async () => await rooms.getSecuredRoomInfo(props.securedRoomId));

	function showQR() {
		loginFlow.value = true;
	}

	function closePopOver() {
		emit('click');
	}
	function retry() {
		loginFail.value = false;
		loginFlow.value = false;
	}

	function loginError(error: string) {
		if (error) loginFail.value = true;
	}
</script>
