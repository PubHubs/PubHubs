<template>
	<div :class="settings.getActiveTheme" class="h-full">
		<div v-if="setupReady" class="h-full text-hub-text">
			<div v-if="user.isLoggedIn" class="md:grid grid-cols-8 h-full">
				<HeaderFooter class="md:col-span-2 md:flex gap-4 bg-hub-background-2" :class="{ hidden: !hubSettings.mobileHubMenu }">
					<template #header>
						<div class="flex justify-between gap-4 items-end border-b h-full py-2 pl-5 mr-8">
							<div class="flex">
								<Badge v-if="hubSettings.isSolo && settings.isFeatureEnabled(featureFlagType.notifications) && rooms.totalUnreadMessages > 0" class="-ml-2 -mt-2">{{ rooms.totalUnreadMessages }}</Badge>
								<router-link to="/" class="flex">
									<Logo class="inline-block h-12"></Logo>
									<TruncatedText class="mt-6">{{ settings.hub.name }}</TruncatedText>
								</router-link>
							</div>
							<div>
								<Avatar
									:userId="user.user.userId"
									:img="avatar"
									@click="
										settingsDialog = true;
										hubSettings.hideBar();
									"
									class="cursor-pointer w-8 h-8 text-md"
								></Avatar>
							</div>
						</div>
					</template>

					<Menu>
						<template v-for="(item, index) in menu.getMenu" :key="index">
							<MenuItem :to="item.to" :icon="item.icon" @click="hubSettings.hideBar()">{{ $t(item.key) }}</MenuItem>
						</template>
					</Menu>

					<H2 class="pl-5 border-b mr-8">{{ $t('menu.rooms') }}</H2>
					<RoomList></RoomList>
					<RouterLink :to="'/discoverRooms'">
						<Button class="mx-auto py-1 my-2 w-5/6" :color="'gray'">
							<Icon type="compass" class="absolute left-0 top-0 -ml-1 -mt-2"></Icon>
							<span class="font-normal">{{ $t('rooms.discover') }}</span>
						</Button>
					</RouterLink>

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
	import { LOGGER } from '@/dev/Logger';
	import { SMI } from '@/dev/StatusMessage';
	import { useDialog } from '@/store/dialog';
	import { useMenu } from '@/store/menu';
	import { usePlugins } from '@/store/plugins';
	import { HubInformation, featureFlagType, Message, MessageBoxType, MessageType, RoomType, Theme, TimeFormat, useHubSettings, useMessageBox, useRooms, useSettings, useUser } from '@/store/store';
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
	const avatar = ref();
	const setupReady = ref(false);
	const disclosureEnabled = settings.isFeatureEnabled('disclosure');

	watch(
		() => rooms.totalUnreadMessages,
		() => {
			rooms.sendUnreadMessageCounter();
		},
	);

	watch(
		() => user.avatarUrl,
		() => {
			avatar.value = user.avatarUrl;
		},
	);

	onMounted(() => {
		plugins.setPlugins(getCurrentInstance()?.appContext.config.globalProperties._plugins, router);
	});

	onMounted(async () => {
		LOGGER.log(SMI.STARTUP_TRACE, 'App.vue onMounted');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		// set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		if (window.location.hash !== '#/hub/') {
			await pubhubs.login();
			setupReady.value = true; // needed if running only the hub-client
			router.push({ name: 'home' });
		}
		await startMessageBox();

		LOGGER.log(SMI.STARTUP_TRACE, 'App.vue onMounted done');
	});

	async function startMessageBox() {
		let messageBoxStarted = false;

		if (!hubSettings.isSolo) {
			await messagebox.init(MessageBoxType.Child, hubSettings.parentUrl);

			// Ask for Hub name etc.
			messagebox.addCallback(MessageType.HubInformation, (message: Message) => {
				settings.hub = message.content as HubInformation;
			});

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

			//Listen to global menu change
			messagebox.addCallback(MessageType.BarHide, () => {
				hubSettings.mobileHubMenu = false;
			});

			messagebox.addCallback(MessageType.BarShow, () => {
				hubSettings.mobileHubMenu = true;
			});

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
