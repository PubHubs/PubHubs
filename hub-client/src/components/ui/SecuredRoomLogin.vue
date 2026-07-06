<template>
	<div class="absolute top-800 flex flex-col text-center">
		<!-- Popup Container -->
		<div class="z-20 box-border h-fit w-[255px] rounded-lg bg-white p-0 drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]">
			<!-- Close Button Inside the Popup (Top-Right) -->
			<IconButton
				v-if="showClose"
				class="absolute top-100 right-100 z-10 p-100 text-black"
				size="base"
				icon="x"
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
				<div class="my-1000 flex flex-col items-center justify-center gap-200">
					<Icon
						class="text-avatar-red"
						size="xl"
						type="prohibit"
					/>
					<P class="text-body ml-100 text-center text-black">
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
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import P from '@hub-client/components/elements/P.vue';
	import QRCode from '@hub-client/components/ui/SecuredRoomQR.vue';

	defineProps({
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

	const { t } = useI18n();

	const loginFail = ref(false);

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
