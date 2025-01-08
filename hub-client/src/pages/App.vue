<template>
	<div :class="settings.getActiveTheme" class="h-full">
		<div v-if="setupReady" class="h-full text-hub-text">
			<div v-if="user.isLoggedIn" class="md:grid grid-cols-8 h-full">
				<HeaderFooter class="md:col-span-2 md:flex bg-hub-background-2" :class="{ hidden: !hubSettings.mobileHubMenu }" :headerBgColor="'bg-hub-background-3'">
					<template #header>
						<div class="flex items-center gap-4">
							<span class="text-xxs uppercase font-bold">hub</span>
							<hr class="grow" />
						</div>
						<div class="flex h-full py-2 justify-between">
							<Badge v-if="hubSettings.isSolo && settings.isFeatureEnabled(FeatureFlag.notifications) && rooms.totalUnreadMessages > 0" class="-ml-4 -mt-2 w-8 flex-none">{{ rooms.totalUnreadMessages }}</Badge>
							<div class="flex flex-1 justify-between items-center">
								<H1 class="line-clamp-1" @click="router.push('/')" :title="settings.hub.name">{{ settings.hub.name }}</H1>
								<!-- TODO: Hiding this settings wheel as there is no functionality to it yet. -->
								<Icon type="cog" size="sm" class="p-2 rounded-md bg-hub-background-2 hidden"></Icon>
							</div>
						</div>
					</template>

					<div class="flex-1 flex-col p-4">
						<section>
							<div
								@click="
									settingsDialog = true;
									hubSettings.hideBar();
								"
								class="flex items-center justify-between p-2 cursor-pointer rounded-lg text-hub-text bg-hub-background-3"
							>
								<div class="flex items-center gap-2">
									<Avatar :user="user" :img="user.avatarUrl"></Avatar>
									<div class="flex flex-col h-fit">
										<p class="font-bold leading-tight">{{ user.displayName }}</p>
										<p class="leading-tight">{{ user.pseudonym ?? '' }}</p>
									</div>
								</div>
								<Icon type="pencil" size="sm" class="p-2 rounded-md stroke-0"></Icon>
							</div>
							<Menu>
								<template v-for="(item, index) in menu.getMenu" :key="index">
									<MenuItem :to="item.to" :icon="item.icon" @click="hubSettings.hideBar()">{{ $t(item.key) }}</MenuItem>
								</template>
							</Menu>
						</section>

						<section class="flex flex-col gap-2">
							<div class="flex items-center justify-between p-2 rounded-lg bg-hub-background-4">
								<H2>{{ $t('menu.rooms') }}</H2>
								<div class="flex gap-2 items-center">
									<router-link :to="{ name: 'discover-rooms' }">
										<Icon type="compass" size="md"></Icon>
									</router-link>
									<!-- TODO: Add functionality to the 3-dots icon. This serves as a hidden placeholder now. -->
									<Icon class="stroke-0 hidden" type="dots" size="sm"></Icon>
								</div>
							</div>
							<RoomList></RoomList>
						</section>

						<section>
							<H2 class="">{{ $t('menu.private_rooms') }}</H2>
							<RoomList :roomType="RoomType.PH_MESSAGES_DM"></RoomList>
							<DiscoverUsers></DiscoverUsers>
						</section>
					</div>

					<!-- When user is admin, show the moderation tools menu -->
					<section v-if="disclosureEnabled && user.isAdmin" class="p-4">
						<H2>{{ $t('menu.moderation_tools') }}</H2>
						<Menu>
							<MenuItem :to="{ name: 'ask-disclosure' }" icon="sign">{{ $t('menu.moderation_tools_disclosure') }}</MenuItem>
						</Menu>
					</section>

					<!-- When user is admin, show the admin tools menu -->
					<section v-if="user.isAdmin" class="p-4">
						<H2>{{ $t('menu.admin_tools') }}</H2>
						<Menu>
							<MenuItem :to="{ name: 'admin' }" icon="admin">{{ $t('menu.admin_tools_rooms') }}</MenuItem>
						</Menu>
					</section>
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
	// Components
	import Avatar from '@/components/ui/Avatar.vue';
	import MenuItem from '@/components/ui/MenuItem.vue';
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import Menu from '@/components/ui/Menu.vue';
	import Icon from '@/components/elements/Icon.vue';
	import RoomList from '@/components/rooms/RoomList.vue';
	import Disclosure from '@/components/rooms/Disclosure.vue';
	import SettingsDialog from '@/components/forms/SettingsDialog.vue';
	import Dialog from '@/components/ui/Dialog.vue';
	import H2 from '@/components/elements/H2.vue';
	import Badge from '@/components/elements/Badge.vue';
	import DiscoverUsers from '@/components/rooms/DiscoverUsers.vue';
	import H1 from '@/components/elements/H1.vue';

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
		LOGGER.trace(SMI.STARTUP, 'App.vue onMounted');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		// set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		// check if hash doesn't start with hub,
		// then it is running only the hub-client, so we need to do some checks
		if (!window.location.hash.startsWith('#/hub/')) {
			pubhubs.login().then(() => (setupReady.value = true));
			// Needs onboarding?
			if (user.needsOnboarding) {
				router.push({ name: 'onboarding' });
			} else {
				router.push({ name: 'home' });
			}
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

		LOGGER.trace(SMI.STARTUP, 'App.vue onMounted done');
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
		}
	}
</script>
