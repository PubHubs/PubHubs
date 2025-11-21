<template>
	<div v-if="showPrompt" class="fixed inset-0 z-50">
		<div class="bg-surface-high absolute inset-0 opacity-80" @click="closePrompt" />
		<div class="bg-background absolute bottom-0 left-0 right-0 flex h-fit w-full flex-col rounded-t-2xl p-2 shadow-[0_-5px_10px_rgba(0,0,0,0.2)]">
			<div class="bg-surface-high absolute right-3 top-3 h-6 w-6 rounded-full">
				<Icon type="x" :as-button="true" @click="closePrompt" />
			</div>
			<div class="flex items-center justify-between pr-12">
				<div class="flex items-center">
					<img alt="PubHubs icon" :src="logoWhiteUrl" class="mr-2 hidden h-10 w-10 dark:block" />
					<img alt="PubHubs icon" :src="logoUrl" class="mr-2 h-10 w-10 dark:hidden" />
					<H1>PubHubs</H1>
				</div>
				<Button v-if="deferredPrompt" size="sm" class="rounded-3xl px-8" @click="clickInstall()">{{ $t('pwa.install') }}</Button>
			</div>
			<hr class="border-surface-high border-t-1 my-2" />
			<div class="px-4 pb-8 pt-4">
				<H3 class="mb-3">{{ $t('pwa.add_app') }}!</H3>
				<p v-if="deferredPrompt">{{ $t('pwa.add_manually') }}</p>
				<!-- Instructions for Android Chrome and Firefox: -->
				<div v-if="props.operatingSystem === 'Android' && ['Chrome', 'Firefox'].includes(props.browser)">
					<InstallPromptInstruction
						:instructions="[
							{ icon: 'dots-three-vertical', instruction: 'pwa.click_menu' },
							{ icon: 'plus', instruction: 'pwa.add_to_homescreen' },
						]"
					/>
				</div>
				<!-- Instructions for Android Samsung Browser: -->
				<div v-else-if="props.operatingSystem === 'Android' && props.browser === 'Samsung Browser'">
					<InstallPromptInstruction
						:instructions="[
							{ icon: 'dots-three-vertical', instruction: 'pwa.click_menu' },
							{ icon: 'plus', instruction: 'pwa.add_page_to' },
						]"
					/>
				</div>
				<!-- Instructions for Android Edge: -->
				<div v-else-if="props.operatingSystem === 'Android' && props.browser === 'Edge'">
					<InstallPromptInstruction
						:instructions="[
							{ icon: 'dots-three-vertical', instruction: 'pwa.click_menu' },
							{ icon: 'plus', instruction: 'pwa.add_to_phone' },
						]"
					/>
				</div>
				<!-- Instructions for Android Opera: -->
				<div v-else-if="props.operatingSystem === 'Android' && props.browser === 'Opera'">
					<InstallPromptInstruction
						:instructions="[
							{ icon: 'dots-three-vertical', instruction: 'pwa.click_menu' },
							{ icon: 'plus', instruction: 'pwa.add_to' },
						]"
					/>
				</div>
				<!-- Instructions for iOS -->
				<div v-else-if="props.operatingSystem === 'iOS'">
					<InstallPromptInstruction
						:instructions="[
							{ icon: 'share', instruction: 'pwa.click_share' },
							{ icon: 'plus', instruction: 'pwa.ios_add_to_homescreen' },
						]"
					/>
				</div>
				<Checkbox color="blue" :label="$t('pwa.do_not_show_again')" v-model="neverShowAgain" class="pt-3"></Checkbox>
				<p class="text-label-small pt-1 italic">{{ $t('pwa.find_instructions') }}</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';

	// Components
	import InstallPromptInstruction from '@global-client/components/ui/InstallPromptInstruction.vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Checkbox from '@hub-client/components/forms/Checkbox.vue';

	// Stores
	import { useInstallPromptStore } from '@global-client/stores/installPromptPWA';

	// Assets
	const logoWhiteUrl = '/client/img/icons/favicon_white.svg';
	const logoUrl = '/client/img/icons/favicon.svg';

	const installPromptStore = useInstallPromptStore();
	const neverShowAgain = ref<boolean>(installPromptStore.neverShowAgain);

	const props = defineProps({
		browser: {
			type: String,
			default: 'Unknown',
		},
		operatingSystem: {
			type: String,
			default: 'Unknown',
		},
	});

	const showPrompt = computed(() => installPromptStore.showPrompt);
	const deferredPrompt = computed(() => installPromptStore.deferredPrompt);

	const closePrompt = () => {
		installPromptStore.setShowPrompt(false);
		installPromptStore.setNeverShowAgain(neverShowAgain.value);
	};

	async function clickInstall() {
		// We can safely assume that defferedPrompt.value is not undefined,
		// since the button that triggers this function is only visible when this is the case.
		deferredPrompt.value!.prompt();
		const userChoice = await deferredPrompt.value!.userChoice;
		installPromptStore.resetDeferredPrompt();
		if (userChoice.outcome === 'accepted') {
			installPromptStore.setNeverShowAgain(true);
			installPromptStore.setShowPrompt(false);
		}
	}
</script>
