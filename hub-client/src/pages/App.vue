<template>
	<div :class="settings.getActiveTheme">
		<div v-if="setupReady" class="max-h-screen text-hub-text">
			<div v-if="user.isLoggedIn" class="md:grid md:grid-cols-8">
				<HeaderFooter class="md:col-span-2 md:flex bg-hub-background-2" :class="{ hidden: !hubSettings.mobileHubMenu }">
					<template #header>
						<div class="flex justify-between">
							<div class="flex-1">
								<Badge v-if="hubSettings.isSolo && rooms.totalUnreadMessages > 0" class="-ml-2 -mt-2">{{ rooms.totalUnreadMessages }}</Badge>
								<router-link to="/">
									<Logo class="absolute h-2/5"></Logo>
								</router-link>
							</div>
							<div class="flex-1 mt-2">
								<Avatar :userId="user.user.userId" :img="avatar" @click="settingsDialog = true" class="cursor-pointer float-right w-8 h-8 text-md"></Avatar>
							</div>
						</div>
					</template>

					<Menu>
						<router-link v-for="(item, index) in menu.getMenu" :key="index" :to="item.to" v-slot="{ isActive }">
							<MenuItem :icon="item.icon" :active="isActive" @click="toggleMenu.toggleGlobalMenu()">{{ $t(item.key) }}</MenuItem>
						</router-link>
					</Menu>

					<!-- When user is admin, show the admin tools menu -->
					<div v-if="user.isAdmin">
						<H2 class="mt-12">{{ $t('menu.admin_tools') }}</H2>
						<Line class="mt-2 mb-4"></Line>
						<Menu>
							<router-link :to="{ name: 'admin' }" v-slot="{ isActive }">
								<MenuItem icon="admin" :active="isActive" @click="toggleMenu.toggleGlobalMenu()">{{ $t('menu.admin_tools_rooms') }}</MenuItem>
							</router-link>
						</Menu>
					</div>

					<!-- When user is admin, show the moderation tools menu -->
					<div v-if="disclosureEnabled && user.isAdmin">
						<H2 class="mt-12">{{ $t('menu.moderation_tools') }}</H2>
						<Line class="mt-2 mb-4"></Line>
						<Menu>
							<router-link :to="{ name: 'ask-disclosure' }" v-slot="{ isActive }">
								<MenuItem icon="sign" :active="isActive" class="hover:text-red">{{ $t('menu.moderation_tools_disclosure') }}</MenuItem>
							</router-link>
						</Menu>
					</div>

					<H2 class="mt-12">{{ $t('menu.rooms') }}</H2>
					<Icon type="plus" class="cursor-pointer hover:text-green float-right -mt-8" @click="joinRoomDialog = true"></Icon>
					<Line class="mt-2 mb-4"></Line>
					<RoomList></RoomList>

					<H2 class="mt-12">{{ $t('menu.private_rooms') }}</H2>
					<Icon type="plus" class="cursor-pointer hover:text-green float-right -mt-8" @click="addPrivateRoomDialog = true"></Icon>
					<Line class="mt-2 mb-4"></Line>
					<RoomList :roomType="PubHubsRoomType.PH_MESSAGES_DM"></RoomList>
				</HeaderFooter>

				<div class="md:col-span-6 md:block max-h-screen bg-hub-background overflow-y-auto" :class="{ hidden: hubSettings.mobileHubMenu }">
					<router-view></router-view>
				</div>
			</div>

			<div v-else>
				<router-view></router-view>
			</div>
		</div>

		<JoinRoom v-if="joinRoomDialog" @close="joinRoomDialog = false"></JoinRoom>
		<AddPrivateRoom v-if="addPrivateRoomDialog" @close="addPrivateRoomDialog = false"></AddPrivateRoom>
		<Disclosure v-if="disclosureEnabled"></Disclosure>

		<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false"></SettingsDialog>

		<Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref, getCurrentInstance } from 'vue';
	import { RouteParamValue, useRouter } from 'vue-router';
	import { Message, MessageBoxType, MessageType, Theme, TimeFormat, useHubSettings, useMessageBox, PubHubsRoomType, useRooms, useSettings, useUser } from '@/store/store';
	import { useDialog } from '@/store/dialog';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useMenu } from '@/store/menu';
	import { usePlugins } from '@/store/plugins';
	import { useI18n } from 'vue-i18n';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';

	const { locale, availableLocales } = useI18n();
	const router = useRouter();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const user = useUser();
	const rooms = useRooms();
	const messagebox = useMessageBox();
	const dialog = useDialog();
	const pubhubs = usePubHubs();
	const { downloadUrl } = useMatrixFiles(pubhubs);
	const plugins = usePlugins();
	const menu = useMenu();
	const toggleMenu = useToggleMenu();
	const settingsDialog = ref(false);

	const setupReady = ref(false);
	const joinRoomDialog = ref(false);
	const addPrivateRoomDialog = ref(false);
	const disclosureEnabled = settings.isFeatureEnabled('disclosure');
	const acknowledgeOnce = ref(true);
	const avatar = ref('');

	onMounted(() => {
		plugins.setPlugins(getCurrentInstance()?.appContext.config.globalProperties._plugins, router);
	});

	onMounted(async () => {
		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		// set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		if (window.location.hash !== '#/hub/') {
			await pubhubs.login();
			router.push({ name: 'home' });
			setupReady.value = true; // needed if running only the hub-client
		}
		await startMessageBox();
		const avatarUrl = await pubhubs.getAvatarUrl();
		if (avatarUrl) {
			avatar.value = downloadUrl + avatar.value.slice(6);
		}
	});

	async function startMessageBox() {
		let messageBoxStarted = false;

		if (!hubSettings.isSolo) {
			await messagebox.init(MessageBoxType.Child, hubSettings.parentUrl);

			// Listen to roomchange
			messagebox.addCallback(MessageType.RoomChange, (message: Message) => {
				const roomId = message.content as RouteParamValue;
				if (rooms.currentRoomId !== roomId) {
					router.push({ name: 'room', params: { id: roomId } });
				}
			});

			// Listen to sync settings
			messagebox.addCallback(MessageType.Settings, (message: Message) => {
				settings.setTheme(message.content.theme as Theme);
				settings.setTimeFormat(message.content.timeformat as TimeFormat);
				settings.setLanguage(message.content.language);
				messageBoxStarted = true;
			});

			//Listen to log in time
			messagebox.addCallback(MessageType.GlobalLoginTime, (message: Message) => {
				pubhubs.updateLoggedInStatusBasedOnGlobalStatus(message.content as string);
			});

			//Listen to global menu change
			messagebox.addCallback(MessageType.mobileHubMenu, (message: Message) => {
				hubSettings.mobileHubMenu = message.content as boolean;
			});

			// Ask for syncing
			messagebox.sendMessage(new Message(MessageType.Sync));

			// Wait for theme change happened
			const wait = setInterval(() => {
				if (messageBoxStarted) {
					setupReady.value = true;
					clearInterval(wait);
				}
			}, 250);
			setTimeout(() => {
				clearInterval(wait);
				setupReady.value = true;
			}, 2500);
		}
	}

	// Additional check to make sure that beforeunload is only called once.
	// An open issue for unload event in mozilla->  https://bugzilla.mozilla.org/show_bug.cgi?id=531199

	window.addEventListener('beforeunload', () => {
		if (acknowledgeOnce.value) {
			rooms.roomsArray.forEach(async (room) => {
				const mEvent: MatrixEvent = rooms.getlastEvent(room.roomId);
				const sender = mEvent.event.sender!;
				await pubhubs.sendAcknowledgementReceipt(sender);
			});
			// Once done then we dont call eventListener again.
			// This will be called only when we are closing the browser.

			acknowledgeOnce.value = false;
		}
	});
</script>
