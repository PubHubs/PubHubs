<template>
	<div class="bg-background font-body text-on-surface text-body h-screen w-full">
		<div v-if="setupReady" class="h-full">
			<div v-if="user.isLoggedIn" class="flex h-full">
				<HeaderFooter class="bg-surface-low w-full" :class="[{ hidden: !hubSettings.mobileHubMenu && isMobile }, !isMobile && 'flex max-w-[40rem]']">
					<template #header>
						<div class="text-on-surface-dim items-center gap-4" :class="isMobile ? 'hidden' : 'flex'">
							<span class="font-semibold uppercase">hub</span>
							<hr class="bg-on-surface-dim h-[2px] grow" />
						</div>
						<div class="flex h-full justify-between py-2">
							<div class="flex items-center justify-between gap-2">
								<div class="group hover:border-on-surface-dim relative flex cursor-pointer items-center gap-2 hover:mt-[2px] hover:border-b-2 hover:border-dotted" @click="copyHubUrl" :title="t('menu.copy_hub_url')">
									<H3 class="font-headings text-on-surface font-semibold">{{ hubSettings.hubName }}</H3>
									<Icon type="copy" size="sm" class="text-on-surface-dim group-hover:text-on-surface absolute top-0 right-0 -mr-2 transition-colors" />
								</div>
								<Notification class="absolute right-4" />
								<!-- TODO: Hiding this settings wheel as there is no functionality to it yet. -->
								<!-- <Icon type="sliders-horizontal" size="sm" class="bg-hub-background-2 rounded-md p-2"/> -->
							</div>
							<Badge v-if="hubSettings.isSolo && settings.isFeatureEnabled(FeatureFlag.notifications) && rooms.totalUnreadMessages > 0" class="aspect-square h-full">{{ rooms.totalUnreadMessages }}1</Badge>
						</div>
					</template>

					<div class="flex flex-col gap-4 p-3 md:p-4" role="menu">
						<section class="flex flex-col gap-2">
							<div class="text-hub-text group bg-surface flex items-center justify-between overflow-hidden rounded-xl py-2 pr-4 pl-2" role="complementary">
								<div class="flex w-full items-center gap-2 truncate">
									<Avatar :avatarUrl="user.userAvatar(user.userId!) ?? user.avatarUrl" :userId="user.userId!" />
									<div class="flex h-fit w-full flex-col overflow-hidden">
										<p class="truncate leading-tight font-bold">
											{{ user.userDisplayName(user.userId!) }}
										</p>
										<p class="leading-tight">{{ user.pseudonym ?? '' }}</p>
									</div>
								</div>
								<Icon
									data-testid="edit-userinfo"
									type="pencil-simple"
									class="hover:text-accent-primary cursor-pointer"
									@click="
										settingsDialog = true;
										hubSettings.hideBar();
									"
								/>
							</div>

							<Menu>
								<template v-for="(item, index) in menu.getMenu" :key="index">
									<MenuItem :to="item.to" :icon="item.icon" @click="hubSettings.hideBar()">{{ t(item.key) }}</MenuItem>
								</template>
							</Menu>
						</section>

						<!-- Public rooms -->
						<RoomListHeader label="admin.public_rooms">
							<template #roomlist>
								<RoomList :roomTypes="PublicRooms" />
							</template>
						</RoomListHeader>

						<!-- Secured rooms -->
						<RoomListHeader label="admin.secured_rooms" tooltipText="admin.secured_rooms_tooltip">
							<template #roomlist>
								<RoomList :roomTypes="SecuredRooms" />
							</template>
						</RoomListHeader>

						<!-- When user is admin, show the moderation tools menu -->
						<RoomListHeader v-if="disclosureEnabled && user.isAdmin" label="menu.moderation_tools">
							<Menu>
								<MenuItem :to="{ name: 'ask-disclosure' }" icon="sign">{{ t('menu.moderation_tools_disclosure') }} </MenuItem>
							</Menu>
						</RoomListHeader>

						<!-- When user is admin, show the admin tools menu -->
						<RoomListHeader v-if="user.isAdmin" label="menu.admin_tools">
							<template #roomlist>
								<Menu>
									<MenuItem :to="{ name: 'admin' }" icon="chats-circle">{{ t('menu.admin_tools_rooms') }} </MenuItem>
									<MenuItem :to="{ name: 'manage-users' }" icon="users">{{ t('menu.admin_tools_users') }}</MenuItem>
									<MenuItem :to="{ name: 'hub-settings' }" icon="sliders-horizontal">{{ t('menu.admin_tools_hub_settings') }}</MenuItem>
								</Menu>
							</template>
						</RoomListHeader>
					</div>
				</HeaderFooter>

				<div class="h-full w-full overflow-x-hidden overflow-y-auto" :class="{ hidden: hubSettings.mobileHubMenu && isMobile }" role="document">
					<router-view></router-view>
				</div>
			</div>
		</div>

		<Disclosure v-if="disclosureEnabled" />

		<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false" />

		<Dialog v-if="dialog.visible" @close="dialog.close" />
	</div>

	<ContextMenu />
</template>

<script setup lang="ts">
	// Packages
	import { ConditionKind, IPushRule, PushRuleKind } from 'matrix-js-sdk';
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { RouteParamValue, useRouter } from 'vue-router';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import SettingsDialog from '@hub-client/components/forms/SettingsDialog.vue';
	import Disclosure from '@hub-client/components/rooms/Disclosure.vue';
	import RoomList from '@hub-client/components/rooms/RoomList.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import Menu from '@hub-client/components/ui/Menu.vue';
	import MenuItem from '@hub-client/components/ui/MenuItem.vue';
	import Notification from '@hub-client/components/ui/Notification.vue';
	import RoomListHeader from '@hub-client/components/ui/RoomListHeader.vue';

	// Composables
	import { useClipboard } from '@hub-client/composables/useClipboard';

	// Logic
	import { PubHubsInvisibleMsgType } from '@hub-client/logic/core/events';
	import { routes } from '@hub-client/logic/core/router';
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { PublicRooms, SecuredRooms } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { HubInformation } from '@hub-client/stores/hub-settings';
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { useMenu } from '@hub-client/stores/menu';
	import { MessageType } from '@hub-client/stores/messagebox';
	import { Message, MessageBoxType, useMessageBox } from '@hub-client/stores/messagebox';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// New design
	import ContextMenu from '@hub-client/new-design/components/ContextMenu.vue';

	const { locale, availableLocales, t } = useI18n();
	const router = useRouter();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const user = useUser();
	const rooms = useRooms();
	const messagebox = useMessageBox();
	const dialog = useDialog();
	const pubhubs = usePubhubsStore();
	const menu = useMenu();
	const { copyHubUrl } = useClipboard();
	const settingsDialog = ref(false);
	const setupReady = ref(false);
	const disclosureEnabled = settings.isFeatureEnabled(FeatureFlag.disclosure);
	const isMobile = computed(() => settings.isMobileState);

	onMounted(async () => {
		LOGGER.trace(SMI.STARTUP, 'App.vue onMounted');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		// set language when changed
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

		// Listen to isMobileState from global client
		window.addEventListener('message', (event) => {
			if (event.data?.isMobileState !== undefined) {
				settings.isMobileState = event.data.isMobileState;
			}
		});
		settings.updateIsMobile();

		await startMessageBox();

		// check if hash doesn't start with hub,
		// then it is running only the hub-client, so we need to do some checks
		if (!window.location.hash.startsWith('#/hub/')) {
			// With sliding-sync, loading is faster.
			await pubhubs.login();
			setupReady.value = true;
			addPushRules();
		}

		if (!user.isLoggedIn) {
			// only needed when loggedIn (then there are user settings to setup)
			setupReady.value = true;
		}

		LOGGER.trace(SMI.STARTUP, 'App.vue onMounted done');
	});

	async function startMessageBox() {
		if (!hubSettings.isSolo) {
			messagebox.init(MessageBoxType.Child);
			await messagebox.startCommunication(hubSettings.parentUrl);

			// Ask for Hub name etc.
			messagebox.addCallback('parentFrame', MessageType.HubInformation, (message: Message) => {
				hubSettings.initHubInformation(message.content as HubInformation);
			});

			// Listen to roomchange
			messagebox.addCallback('parentFrame', MessageType.RoomChange, async (message: Message) => {
				const content = message.content as RouteParamValue;
				const isNonRoomRoute = routes.some((r) => r.name === content && r.name !== 'room');
				if (isNonRoomRoute) {
					router.push({ name: content });
				} else {
					router.push({ name: 'room', params: { id: content } });
				}
			});

			// Listen to global menu change
			messagebox.addCallback('parentFrame', MessageType.BarHide, () => {
				hubSettings.mobileHubMenu = false;
			});

			messagebox.addCallback('parentFrame', MessageType.BarShow, () => {
				hubSettings.mobileHubMenu = true;
			});

			// Ask for hubinformation
			messagebox.sendMessage(new Message(MessageType.SendHubInformation));
		}
	}

	function addPushRules() {
		// Add a pushrule to make sure that events that modify a voting widget (poll or date picker) do not trigger unread messages and mentions.
		const pushrule: IPushRule = {
			actions: [],
			conditions: [{ kind: ConditionKind.EventMatch, key: 'type', pattern: PubHubsInvisibleMsgType.VotingWidgetModify }],
			default: false,
			enabled: true,
			rule_id: 'votingwidgetmodify',
		};
		pubhubs.client.addPushRule('global', PushRuleKind.Override, 'votingwidgetmodify', pushrule);
	}

	function setTheme(theme: string) {
		const html = document.documentElement;
		if (theme === 'dark') {
			html.classList.add('dark');
		} else {
			html.classList.remove('dark');
		}
	}
</script>
