<template>
	<div :class="settings.getActiveTheme">
		<div v-if="setupReady" class="max-h-screen text-black dark:bg-gray-dark dark:text-white">
			<div v-if="user.isLoggedIn" class="md:grid md:grid-cols-8">
				<HeaderFooter class="md:col-span-2 md:flex theme-light:bg-gray-lighter2" :class="{ hidden: !hubSettings.mobileHubMenu }">
					<template #header>
						<router-link to="/">
							<Badge v-if="hubSettings.isSolo && rooms.totalUnreadMessages > 0" class="-ml-2 -mt-2">{{ rooms.totalUnreadMessages }}</Badge>
							<Logo class="absolute h-2/5 bottom-3"></Logo>
						</router-link>
					</template>

					<Menu>
						<router-link v-for="(item, index) in menu.getMenu" :key="index" :to="item.to" v-slot="{ isActive }">
							<MenuItem :icon="item.icon" :active="isActive" @click="toggleMenu.toggleGlobalMenu()">{{ $t(item.key) }}</MenuItem>
						</router-link>
					</Menu>

					<H2 class="mt-12">{{ $t('menu.rooms') }}</H2>
					<Icon type="plus" class="cursor-pointer hover:text-green float-right -mt-8" @click="joinRoomDialog = true"></Icon>
					<Line class="mt-2 mb-4"></Line>
					<RoomList></RoomList>

					<H2 class="mt-12">{{ $t('menu.private_rooms') }}</H2>
					<Icon type="plus" class="cursor-pointer hover:text-green float-right -mt-8" @click="addPrivateRoomDialog = true"></Icon>
					<Line class="mt-2 mb-4"></Line>
					<RoomList :roomType="PubHubsRoomType.PH_MESSAGES_DM"></RoomList>

					<template #footer>
						<Menu class="flex">
							<router-link :to="{ name: 'settings', params: {} }" v-slot="{ isActive }">
								<MenuItem icon="cog" :active="isActive"></MenuItem>
							</router-link>
							<router-link v-if="user.isAdmin" :to="{ name: 'admin', params: {} }" v-slot="{ isActive }" class="grow">
								<MenuItem icon="admin" :active="isActive" class="float-right"></MenuItem>
							</router-link>
						</Menu>
					</template>
				</HeaderFooter>

				<div class="md:col-span-6 md:block max-h-screen dark:bg-gray-middle overflow-y-auto" :class="{ hidden: hubSettings.mobileHubMenu }">
					<router-view></router-view>
				</div>
			</div>

			<div v-else>
				<router-view></router-view>
			</div>
		</div>

		<JoinRoom v-if="joinRoomDialog" @close="joinRoomDialog = false"></JoinRoom>
		<AddPrivateRoom v-if="addPrivateRoomDialog" @close="addPrivateRoomDialog = false"></AddPrivateRoom>

		<Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref, getCurrentInstance } from 'vue';
	import { RouteParamValue, useRouter } from 'vue-router';
	import { Message, MessageBoxType, MessageType, Theme, TimeFormat, useHubSettings, useMessageBox, PubHubsRoomType, useRooms, useSettings, useUser } from '@/store/store';
	import { useDialog } from '@/store/dialog';
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
	const plugins = usePlugins();
	const menu = useMenu();
	const toggleMenu = useToggleMenu();

	const setupReady = ref(false);
	const joinRoomDialog = ref(false);
	const addPrivateRoomDialog = ref(false);
	const acknowledgeOnce = ref(true);

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
	import { MatrixEvent } from 'matrix-js-sdk';

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
