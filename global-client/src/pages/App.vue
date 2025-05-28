<template>
	<div class="h-full min-w-[32rem] bg-background font-body text-on-surface ~text-base-min/base-max">
		<MobileMenu v-if="!(route.name === 'home' || route.name === 'onboarding')" />

		<div class="flex h-full">
			<GlobalBar v-if="!(route.name === 'onboarding')" />
			<!-- FIXME: Split giscover hub page and login home page into seperate pages-->
			<div v-if="hubs.hasHubs" class="max-screen w-full flex-1">
				<router-view />
			</div>
		</div>
	</div>

	<Dialog v-if="dialog.visible" @close="dialog.close" />
</template>

<script setup lang="ts">
	// Package imports
	import { onMounted, onUnmounted, watchEffect, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute } from 'vue-router';

	// Global imports
	import GlobalBar from '@/components/ui/GlobalBar.vue';
	import { useInstallPromptStore } from '@/logic/store/installPromptPWA';
	import { NotificationsPermission } from '@/logic/store/settings';
	import { MessageBoxType, useDialog, useGlobal, useHubs, useMessageBox, useSettings } from '@/logic/store/store';

	// Hub imports
	import { CONFIG } from '@/../../hub-client/src/logic/foundation/Config';
	import { Logger } from '@/../../hub-client/src/logic/foundation/Logger';
	import { SMI } from '@/../../hub-client/src/logic/foundation/StatusMessage';

	const LOGGER = new Logger('GC', CONFIG);
	const { locale, availableLocales } = useI18n();
	const messagebox = useMessageBox();
	const settings = useSettings();
	const dialog = useDialog();
	const global = useGlobal();
	const installPromptStore = useInstallPromptStore();
	const hubs = useHubs();
	const route = useRoute();

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

		if (await global.checkLoginAndSettings()) {
			// Watch for saved state changes and save to backend
			watchEffect(() => global.saveGlobalSettings());
		}

		messagebox.init(MessageBoxType.Parent);

		await addHubs();

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
		const hubsResponse = await global.getHubs();
		if (hubsResponse) {
			hubs.addHubs(hubsResponse);
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
