<template>
	<div :class="settings.getActiveTheme">
		<div v-if="setupReady" class="max-h-screen text-hub-text">
			<div v-if="user.isLoggedIn" class="md:grid md:grid-cols-8">
				<HeaderFooter class="md:col-span-2 md:flex gap-4 bg-hub-background-2" :class="{ hidden: !hubSettings.mobileHubMenu }">
					<template #header>
						<div class="flex justify-between gap-4 items-end border-b h-full py-2 pl-5 mr-8">
							<div class="flex h-full">
								<Badge v-if="hubSettings.isSolo && settings.isFeatureEnabled(featureFlagType.notifications) && rooms.totalUnreadMessages > 0" class="-ml-2 -mt-2">{{ rooms.totalUnreadMessages }}</Badge>
								<router-link to="/">
									<Logo class="h-full"></Logo>
								</router-link>
							</div>
							<div>
								<Avatar
									:userId="user.user.userId"
									:img="avatar"
									:icon="true"
									@click="
										settingsDialog = true;
										toggleMenu.toggleGlobalMenu();
									"
									class="cursor-pointer w-8 h-8 text-md"
								></Avatar>
							</div>
						</div>
					</template>

					<Menu>
						<router-link v-for="(item, index) in menu.getMenu" :key="index" :to="item.to" v-slot="{ isActive }">
							<MenuItem :icon="item.icon" :active="isActive" @click="toggleMenu.toggleGlobalMenu()">{{ $t(item.key) }}</MenuItem>
						</router-link>
					</Menu>

					<div class="flex justify-between items-center pl-5 border-b mr-8">
						<H2>{{ $t('menu.rooms') }}</H2>
					</div>
					<RoomList></RoomList>
					<DiscoverRooms></DiscoverRooms>

					<div class="flex justify-between items-center pl-5 border-b mr-8">
						<H2 class="">{{ $t('menu.private_rooms') }}</H2>
					</div>
					<RoomList :roomType="RoomType.PH_MESSAGES_DM"></RoomList>
					<DiscoverUsers></DiscoverUsers>

					<!-- When user is admin, show the moderation tools menu -->
					<div v-if="disclosureEnabled && user.isAdmin">
						<div class="pl-5 border-b mr-8">
							<H2>{{ $t('menu.moderation_tools') }}</H2>
						</div>
						<Menu>
							<router-link :to="{ name: 'ask-disclosure' }" v-slot="{ isActive }">
								<MenuItem icon="sign" :active="isActive">{{ $t('menu.moderation_tools_disclosure') }}</MenuItem>
							</router-link>
						</Menu>
					</div>

					<!-- When user is admin, show the admin tools menu -->
					<div v-if="user.isAdmin">
						<div class="pl-5 border-b mr-8">
							<H2>{{ $t('menu.admin_tools') }}</H2>
						</div>
						<Menu>
							<router-link :to="{ name: 'admin' }" v-slot="{ isActive }">
								<MenuItem icon="admin" :active="isActive" @click="toggleMenu.toggleGlobalMenu()">{{ $t('menu.admin_tools_rooms') }}</MenuItem>
							</router-link>
						</Menu>
					</div>
				</HeaderFooter>

				<div class="md:col-span-6 md:block dark:bg-gray-middle max-h-screen overflow-y-auto scrollbar" :class="{ hidden: hubSettings.mobileHubMenu }">
					<router-view></router-view>
				</div>
			</div>

			<div v-else>
				<router-view></router-view>
			</div>
		</div>

		<AddPrivateRoom v-if="addPrivateRoomDialog" @close="addPrivateRoomDialog = false"></AddPrivateRoom>
		<Disclosure v-if="disclosureEnabled"></Disclosure>

		<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false"></SettingsDialog>

		<Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref, getCurrentInstance, watch } from 'vue';
	import { RouteParamValue, useRouter } from 'vue-router';
	import { Message, MessageBoxType, MessageType, Theme, TimeFormat, useHubSettings, useMessageBox, RoomType, useRooms, useSettings, featureFlagType, useUser } from '@/store/store';
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
	const { downloadUrl } = useMatrixFiles();
	const plugins = usePlugins();
	const menu = useMenu();
	const toggleMenu = useToggleMenu();
	const settingsDialog = ref(false);

	const setupReady = ref(false);
	const disclosureEnabled = settings.isFeatureEnabled('disclosure');
	const avatar = ref('');

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
		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		// set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		if (window.location.hash !== '#/hub/') {
			await pubhubs.login();
			router.push({ name: 'home' });
			setupReady.value = true; // needed if running only the hub-client

			const avatarUrl = await pubhubs.getAvatarUrl();
			if (avatarUrl !== '') {
				avatar.value = downloadUrl + avatarUrl.slice(6);
			}
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
</script>
