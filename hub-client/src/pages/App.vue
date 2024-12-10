<template>
	<div :class="settings.getActiveTheme" class="h-full">
		<div v-if="setupReady" class="h-full text-hub-text">
			<div v-if="user.isLoggedIn" class="md:grid grid-cols-8 h-full">
				<HeaderFooter class="md:col-span-2 md:flex bg-hub-background-2" :class="{ hidden: !hubSettings.mobileHubMenu }">
					<template #header>
						<div class="flex justify-between gap-4 items-end h-full py-2 pl-5 pr-8 bg-hub-background-3">
							<Badge v-if="hubSettings.isSolo && settings.isFeatureEnabled(FeatureFlag.notifications) && rooms.totalUnreadMessages > 0" class="-ml-4 -mt-2 w-8 flex-none">{{ rooms.totalUnreadMessages }}</Badge>
							<Logo class="inline-block h-12" @click="router.push('/')" :title="settings.hub.name"></Logo>
							<span class="mt-6 truncate" @click="router.push('/')" :title="settings.hub.name">
								{{ settings.hub.name }}
							</span>
							<Avatar
								:user="user"
								@click="
									settingsDialog = true;
									hubSettings.hideBar();
								"
								class="cursor-pointer w-8 h-8 text-md"
							></Avatar>
						</div>
					</template>

					<Menu>
						<template v-for="(item, index) in menu.getMenu" :key="index">
							<MenuItem :to="item.to" :icon="item.icon" @click="hubSettings.hideBar()">{{ $t(item.key) }}</MenuItem>
						</template>
					</Menu>

					<H2 class="pl-5 border-b mr-8">{{ $t('menu.rooms') }}</H2>
					<RoomList></RoomList>
					<Button @click="router.push('/discoverRooms')" class="mx-auto py-1 my-2 w-5/6" :color="'gray'">
						<Icon type="compass" class="absolute left-0 top-0 -ml-1 -mt-2"></Icon>
						<span class="font-normal">{{ $t('rooms.discover') }}</span>
					</Button>

					<H2 class="pl-5 border-b mr-8">{{ $t('menu.private_rooms') }}</H2>
					<RoomList :roomType="RoomType.PH_MESSAGES_DM"></RoomList>
					<DiscoverUsers></DiscoverUsers>

					<template #footer>
						<!-- When user is admin, show the moderation tools menu -->
						<div v-if="disclosureEnabled && user.isAdmin">
							<H2 class="pl-5 border-b mr-8">{{ $t('menu.moderation_tools') }}</H2>
							<Menu>
								<MenuItem :to="{ name: 'ask-disclosure' }" icon="sign">{{ $t('menu.moderation_tools_disclosure') }}</MenuItem>
							</Menu>
						</div>

						<!-- When user is admin, show the admin tools menu -->
						<div v-if="user.isAdmin">
							<H2 class="pl-5 border-b mr-8">{{ $t('menu.admin_tools') }}</H2>
							<Menu>
								<MenuItem :to="{ name: 'admin' }" icon="admin">{{ $t('menu.admin_tools_rooms') }}</MenuItem>
							</Menu>
						</div>
					</template>
				</HeaderFooter>

				<div class="md:col-span-6 md:block dark:bg-gray-middle h-full overflow-y-auto scrollbar" :class="{ hidden: hubSettings.mobileHubMenu }">
					<router-view></router-view>
				</div>
			</div>

			<div v-else>
				<router-view></router-view>
			</div>
		</div>

		<Disclosure v-if="disclosureEnabled"></Disclosure>

		<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false"></SettingsDialog>

		<Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>
	</div>
</template>

<script setup lang="ts">
	import { usePubHubs } from '@/core/pubhubsStore';
	import { LOGGER } from '@/foundation/Logger';
	import { SMI } from '@/dev/StatusMessage';
	import { useDialog } from '@/store/dialog';
	import { useMenu } from '@/store/menu';
	import { MessageType } from '@/store/messagebox';
	import { usePlugins } from '@/store/plugins';
	import { RoomType } from '@/store/rooms';
	import { FeatureFlag, HubInformation, useSettings } from '@/store/settings';
	import { Message, MessageBoxType, useHubSettings, useMessageBox, useRooms } from '@/store/store';
	import { useUser } from '@/store/user';
	import { getCurrentInstance, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { RouteParamValue, useRouter } from 'vue-router';

	import Avatar from '@/components/ui/Avatar.vue';

	const { locale, availableLocales } = useI18n();
	const router = useRouter();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const user = useUser();
	const rooms = useRooms();
	const messagebox = useMessageBox();
	const dialog = useDialog();
	const pubhubs = usePubHubs();
	const plugins = usePlugins();
	const menu = useMenu();
	const settingsDialog = ref(false);
	const setupReady = ref(false);
	const disclosureEnabled = settings.isFeatureEnabled(FeatureFlag.disclosure);

	watch(
		() => rooms.totalUnreadMessages,
		() => {
			rooms.sendUnreadMessageCounter();
		},
	);

	onMounted(() => {
		plugins.setPlugins(getCurrentInstance()?.appContext.config.globalProperties._plugins, router);
	});

	onMounted(async () => {
		LOGGER.trace(SMI.STARTUP_TRACE, 'App.vue onMounted');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		// set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		// check if hash doesn't start with hub,
		// then it is running only the hub-client, so we need to do some checks
		if (!window.location.hash.startsWith('#/hub/')) {
			pubhubs.login().then(() => (setupReady.value = true));
			router.push({ name: 'home' });
			// 2024 12 03 The await is removed, because of slow loading testhub
			// After the next merge to stable, in case this gives no problems,
			// the old code and comments can be removed
			// If all works well: setupReady can also be removed, since it does have no function anymmore
			// await pubhubs.login();
			// setupReady.value = true; // needed if running only the hub-client
			// router.push({ name: 'home' });
		}

		if (!user.isLoggedIn) {
			// only needed when loggedIn (then there are user settings to setup)
			setupReady.value = true;
		}
		await startMessageBox();

		LOGGER.trace(SMI.STARTUP_TRACE, 'App.vue onMounted done');
	});

	async function startMessageBox() {
		if (!hubSettings.isSolo) {
			await messagebox.init(MessageBoxType.Child, hubSettings.parentUrl);

			// Ask for Hub name etc.
			messagebox.addCallback(MessageType.HubInformation, (message: Message) => {
				settings.hub = message.content as HubInformation;
			});

			// Listen to roomchange
			messagebox.addCallback(MessageType.RoomChange, async (message: Message) => {
				const roomId = message.content as RouteParamValue;
				if (rooms.currentRoomId !== roomId) {
					rooms.currentRoomId = roomId;
					await rooms.getSecuredRoomInfo(roomId);
					if (rooms.securedRoom && rooms.securedRoom !== null) {
						router.push({ name: 'secure-room', params: { id: roomId } });
					} else {
						router.push({ name: 'room', params: { id: roomId } });
					}
				}
			});

			//Listen to global menu change
			messagebox.addCallback(MessageType.BarHide, () => {
				hubSettings.mobileHubMenu = false;
			});

			messagebox.addCallback(MessageType.BarShow, () => {
				hubSettings.mobileHubMenu = true;
			});

			// Wait for theme change happened
			// const wait = setInterval(() => {
			// 	console.log('Waiting...', messageBoxStarted);
			// 	if (messageBoxStarted) {
			// 		setupReady.value = true;
			// 		clearInterval(wait);
			// 	}
			// }, 250);
			// setTimeout(() => {
			// 	clearInterval(wait);
			// 	setupReady.value = true;
			// }, 2500);
		}
	}
</script>
