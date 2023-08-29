<template>
	<div :class="settings.getActiveTheme">
		<div v-if="setupReady" class="w-screen h-screen bg-white text-black dark:bg-gray-dark dark:text-white">
			<div v-if="user.isLoggedIn" class="grid grid-cols-8">
				<HeaderFooter class="col-span-2">
					<template #header>
						<router-link to="/">
							<Badge v-if="hubSettings.isSolo && rooms.totalUnreadMessages > 0" class="-ml-2 -mt-2">{{ rooms.totalUnreadMessages }}</Badge>
							<Logo class="absolute h-2/5 bottom-3"></Logo>
						</router-link>
					</template>

					<Menu>
						<router-link to="/" v-slot="{ isActive }">
							<MenuItem icon="home" :active="isActive">{{ $t('menu.home') }}</MenuItem>
						</router-link>
						<MenuItem>{{ $t('menu.calender') }}</MenuItem>
						<MenuItem>{{ $t('menu.tool') }}</MenuItem>
					</Menu>

					<H2 class="mt-12">{{ $t('menu.rooms') }}</H2>
					<Icon type="plus" class="cursor-pointer hover:text-green float-right -mt-8" @click="joinRoomDialog = true"></Icon>
					<Line></Line>
					<RoomList></RoomList>

					<H2 class="mt-12">{{ $t('menu.private_rooms') }}</H2>
					<Icon type="plus" class="cursor-pointer hover:text-green float-right -mt-8" @click="addPrivateRoomDialog = true"></Icon>
					<Line></Line>
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

				<div class="col-span-6 overflow-auto bg-white dark:bg-gray-middle">
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
	import { onMounted, ref } from 'vue';
	import { RouteParamValue, useRouter } from 'vue-router';
	import { Message, MessageBoxType, MessageType, Theme, useHubSettings, useMessageBox, PubHubsRoomType, useRooms, useSettings, useUser } from '@/store/store';
	import { useDialog } from '@/store/dialog';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useI18n } from 'vue-i18n';

	const { locale, availableLocales } = useI18n();
	const router = useRouter();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const user = useUser();
	const rooms = useRooms();
	const messagebox = useMessageBox();
	const dialog = useDialog();
	const pubhubs = usePubHubs();

	const setupReady = ref(false);
	const joinRoomDialog = ref(false);
	const addPrivateRoomDialog = ref(false);

	onMounted(async () => {
		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		// set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		if (window.location.hash !== '#/hub/') {
			await pubhubs.login();
			router.push({ name: 'home' });
			setupReady.value = true;
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
				settings.setLanguage(message.content.language);
				messageBoxStarted = true;
			});

			//Listen to log in time
			messagebox.addCallback(MessageType.GlobalLoginTime, (message: Message) => {
				pubhubs.updateLoggedInStatusBasedOnGlobalStatus(message.content as string);
			});

			// Wait for theme change happened
			const wait = setInterval(() => {
				if (messageBoxStarted) {
					setupReady.value = true;
					clearInterval(wait);
				}
			}, 10);
			setTimeout(() => {
				clearInterval(wait);
				setupReady.value = true;
			}, 250);
		}
	}
</script>