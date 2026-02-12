<template>
	<div id="layout-root" class="bg-background font-body text-on-surface text-body flex h-[100svh] w-screen min-w-[32rem] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-none">
		<MobileMenu v-if="!(route.name === 'onboarding' || route.name === 'login' || route.name === 'error')" />
		<GlobalBar v-if="!(route.name === 'onboarding' || route.name === 'login')" />

		<router-view
			class="flex h-full shrink-0 overflow-y-auto"
			:class="isMobile && !(route.name === 'onboarding' || route.name === 'home' || route.name === 'login' || route.name === 'error') ? '!w-[calc(200vw_-_80px)]' : '!w-[calc(100vw_-_80px)] flex-1'"
		/>

		<!-- 0-width element for snapping -->
		<div v-if="!(route.name === 'onboarding' || route.name === 'login' || route.name === 'error')" class="w-0 shrink-0 snap-end" :class="!isMobile && 'hidden'" />
	</div>

	<Dialog v-if="dialog.visible" :type="dialog.properties.type" @close="dialog.close" />

	<ContextMenu />
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, onUnmounted, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	// Components
	import GlobalBar from '@global-client/components/ui/GlobalBar.vue';
	import MobileMenu from '@global-client/components/ui/MobileMenu.vue';

	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import useRootScroll from '@global-client/composables/useRootScroll';

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

	// New design
	import ContextMenu from '@hub-client/new-design/components/ContextMenu.vue';

	const isMobile = computed(() => settings.isMobileState);
	const LOGGER = new Logger('GC', CONFIG);
	const { locale, availableLocales } = useI18n();
	const { scrollToEnd, scrollToStart, setupSnapEnforcement, cleanupSnapEnforcement } = useRootScroll();
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
		settings.startListeningMobile();

		// Update root scroll state on iframe message
		window.addEventListener('message', (event) => {
			if (event.data?.handleGlobalScroll !== undefined) {
				if (event.data.handleGlobalScroll === 'scrollToStart') {
					scrollToStart();
				} else if (event.data.handleGlobalScroll === 'scrollToEnd') {
					scrollToEnd();
				}
			}
		});

		// Watch for saved state changes and save to backend
		watch(
			computedGlobalSettings,
			() => {
				global.saveGlobalSettings();
			},
			{ deep: true },
		);

		messagebox.init(MessageBoxType.Parent);

		addHubs();

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

		setupSnapEnforcement();

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
		settings.stopListeningMobile();
		cleanupSnapEnforcement();
	});
</script>
