<template>
	<div class="bg-background font-body text-on-surface text-body h-full min-w-[32rem]">
		<MobileMenu v-if="!(route.name === 'onboarding')" />

		<div class="flex h-full">
			<GlobalBar v-if="!(route.name === 'onboarding')" />
			<div class="h-[100dvh] w-full flex-1">
				<router-view />
			</div>
		</div>
	</div>

	<Dialog v-if="dialog.visible" @close="dialog.close" />
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, onUnmounted, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	// Components
	import GlobalBar from '@global-client/components/ui/GlobalBar.vue';

	// Logic
	import { CONFIG } from '@hub-client/logic/logging/Config';
	import { Logger } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';
	import { useInstallPromptStore } from '@global-client/stores/installPromptPWA';

	import { useDialog } from '@hub-client/stores/dialog';
	import { MessageBoxType, useMessageBox } from '@hub-client/stores/messagebox';
	import { NotificationsPermission, useSettings } from '@hub-client/stores/settings';

	const LOGGER = new Logger('GC', CONFIG);
	const { locale, availableLocales } = useI18n();
	const messagebox = useMessageBox();
	const settings = useSettings();
	const dialog = useDialog();
	const global = useGlobal();
	const installPromptStore = useInstallPromptStore();
	const hubs = useHubs();
	const route = useRoute();
	const router = useRouter();

	// Wrapping the getter inside a computed to trigger the watch function to save any changes in global settings
	const computedGlobalSettings = computed(() => global.getGlobalSettings);

	// Function to initialize settings and language
	async function initializeSettings() {
		LOGGER.log(SMI.STARTUP, 'App.vue onMounted...');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		dialog.asGlobal();

		// Set the information needed for the installation prompt for the PWA
		installPromptStore.loadNeverShowAgain();
		installPromptStore.checkConditionsAndSetPrompt();

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			installPromptStore.setDeferredPrompt(e);
		});

		// Change active language to the user's preferred language
		locale.value = settings.getActiveLanguage;

		// Set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		// Set theme based on settings
		setTheme(settings.getActiveTheme);

		// Watch for theme changes
		watch(
			() => settings.getActiveTheme,
			(newTheme) => {
				setTheme(newTheme);
			},
		);

		// Update isMobile state on initial load
		settings.startListening();

		// Watch for saved state changes and save to backend
		watch(
			computedGlobalSettings,
			() => {
				global.saveGlobalSettings();
			},
			{ deep: true },
		);

		messagebox.init(MessageBoxType.Parent);

		await addHubs();

		if (!hubs.hasHubs) {
			router.push({ name: 'error', query: { errorKey: 'errors.no_hubs_found' } });
		}

		// Watch for changes in the permission for notifications by the user to reflect these changes once the user opens the settings dialog
		if ('permissions' in navigator) {
			navigator.permissions.query({ name: 'notifications' }).then(function (notificationPerm) {
				notificationPerm.onchange = function () {
					if (notificationPerm.state === 'prompt' || notificationPerm.state === 'denied') {
						settings.setNotificationPermission(NotificationsPermission.Deny);
					}
				};
			});
		}

		LOGGER.log(SMI.STARTUP, 'App.vue onMounted done', { language: settings.getActiveLanguage });
	}

	// Function to add hubs
	async function addHubs() {
		try {
			await global.getHubs();
		} catch (error) {
			global.setLoadingHubs(false);
			router.push({ name: 'error', query: { errorKey: 'errors.no_hubs_found' } });
			LOGGER.error(SMI.ERROR, 'Error adding hubs', { error });
		}
	}

	function setTheme(theme: string) {
		const html = document.documentElement;
		if (theme === 'dark') {
			html.classList.add('dark');
		} else {
			html.classList.remove('dark');
		}
	}

	// Lifecycle hook
	onMounted(initializeSettings);

	onUnmounted(() => {
		settings.stopListening();
	});
</script>
