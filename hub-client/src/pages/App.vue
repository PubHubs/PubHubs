<template>
	<div v-if="user.isLoggedIn && setupReady" class="font-body text-on-surface text-body flex h-screen w-full overflow-hidden">
		<HeaderFooter class="relative shrink-0" :class="isMobile ? 'w-[calc(50%-40px)]!' : 'flex max-w-[320px]'">
			<template #header>
				<div class="flex h-full w-full justify-between py-2">
					<div class="mt-1 flex items-center justify-between gap-2">
						<div class="group hover:border-on-surface-dim hover:mt-025 relative flex cursor-pointer items-center gap-2 hover:border-b-2 hover:border-dotted" @click="copyHubUrl" :title="t('menu.copy_hub_url')">
							<H3 class="font-headings text-h2 text-on-surface font-semibold">{{ hubSettings.hubName }}</H3>
							<Icon type="copy" size="sm" class="text-on-surface-dim group-hover:text-on-surface absolute top-0 right-0 -mr-2 transition-colors" />
						</div>
						<Notification />
					</div>
					<Badge v-if="hubSettings.isSolo && settings.isFeatureEnabled(FeatureFlag.notifications) && rooms.totalUnreadMessages > 0" class="aspect-square h-full">{{ rooms.totalUnreadMessages }}1</Badge>
				</div>
			</template>

			<div class="flex flex-col gap-4 p-3 md:p-4" role="menu">
				<section class="flex flex-col gap-2">
					<div class="bg-surface text-hub-text group rounded-base flex h-16 items-center justify-between overflow-hidden py-2 pr-4 pl-2" role="complementary">
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
								scrollToEnd();
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
				<RoomListHeader v-if="hasPublicRooms" label="admin.public_rooms">
					<template #roomlist>
						<RoomList :roomTypes="PublicRooms" />
					</template>
				</RoomListHeader>

				<!-- Secured rooms -->
				<RoomListHeader v-if="hasSecuredRooms" label="admin.secured_rooms" tooltipText="admin.secured_rooms_tooltip">
					<template #roomlist>
						<RoomList :roomTypes="SecuredRooms" />
					</template>
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

		<div class="h-full min-w-0 flex-1 overflow-hidden" :class="isMobile ? 'w-screen' : ''" role="document">
			<router-view />
		</div>

		<Disclosure v-if="disclosureEnabled" />

		<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false" />

		<Dialog v-if="dialog.visible" :type="dialog.properties.type" @close="dialog.close" />
	</div>

	<ContextMenu />
</template>

<script setup lang="ts">
	// Packages
	import { ConditionKind, IPushRule, PushRuleKind } from 'matrix-js-sdk';
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { NavigationFailure, RouteParamValue, isNavigationFailure, useRouter } from 'vue-router';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import SettingsDialog from '@hub-client/components/forms/SettingsDialog.vue';
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
	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { PubHubsInvisibleMsgType } from '@hub-client/logic/core/events';
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { QueryParameterKey } from '@hub-client/models/constants';
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
	const { scrollToEnd, scrollToStart } = useGlobalScroll();

	const hasPublicRooms = computed(() => rooms.filteredRoomList(PublicRooms).length > 0 || !rooms.roomsLoaded);
	const hasSecuredRooms = computed(() => rooms.filteredRoomList(SecuredRooms).length > 0 || !rooms.roomsLoaded);

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
		window.parent.postMessage({ type: 'viewport-ready' }, '*');
		window.addEventListener('message', handleViewport);

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

	const handleViewport = (e: MessageEvent) => {
		if (e.data?.type === 'viewport-update') {
			settings.isMobileState = e.data.isMobileState;
		}
	};

	async function startMessageBox() {
		if (!hubSettings.isSolo) {
			messagebox.init(MessageBoxType.Child);
			await messagebox.startCommunication(hubSettings.parentUrl);

			// Ask for Hub name etc.
			messagebox.addCallback('parentFrame', MessageType.HubInformation, (message: Message) => {
				hubSettings.initHubInformation(message.content as HubInformation);
			});

			messagebox.addCallback('parentFrame', MessageType.RoomChange, async (message: Message) => {
				let navigationResult: NavigationFailure | void | undefined = undefined;
				//TODO: content from MessageType.RoomChange is roomId? maybe we can rename content to roomId.
				const content = message.content as RouteParamValue;
				// If content is a roomId then it has a format that starts with !.
				if (content.startsWith('!')) {
					navigationResult = await router.push({ name: 'room', params: { id: content } });
				} else {
					navigationResult = await router.push({ name: content as any });
				}

				// FALLBACK to homepage if there is a navigation failure.
				if (navigationResult && isNavigationFailure(navigationResult)) {
					await router.push({ name: 'home' });
				}
			});

			// Listen to event change
			messagebox.addCallback('parentFrame', MessageType.EventChange, (message: Message) => {
				const url = message.content;

				const [routePart, queryPart] = url.split('?');

				const params = new URLSearchParams(queryPart);

				const eventId = params.get(QueryParameterKey.EventId);

				if (!eventId) return;

				// Ignore any empty values
				const splitRoutePart: string[] = routePart.split('/').filter(Boolean);

				const roomId = splitRoutePart[splitRoutePart.length - 1];

				// Set the scroll position to event
				rooms.scrollPositions[roomId] = eventId;
			});

			// Listen to global menu change
			messagebox.addCallback('parentFrame', MessageType.BarHide, () => {
				hubSettings.mobileHubMenu = false;
			});

			messagebox.addCallback('parentFrame', MessageType.BarShow, () => {
				hubSettings.mobileHubMenu = true;
			});

			// Listen to close sidebar message from global client
			// If sidebar is open, close it. If not, request scroll to start.
			messagebox.addCallback('parentFrame', MessageType.CloseSidebar, () => {
				const sidebar = useSidebar();
				if (sidebar.isOpen.value) {
					sidebar.close();
				} else {
					scrollToStart();
				}
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
