<template>
	<div
		v-if="user.isLoggedIn && setupReady"
		class="bg-background font-body text-on-surface text-body flex h-screen w-full overflow-hidden"
	>
		<HubSidebar @open-settings="settingsDialog = true" />

		<div
			class="h-full min-w-0 flex-1 overflow-x-hidden"
			:class="isMobile && !hubSettings.isSolo ? 'w-screen' : ''"
			role="document"
		>
			<router-view />
		</div>

		<SettingsDialog
			v-if="settingsDialog"
			@close="settingsDialog = false"
		/>

		<Dialog
			v-if="dialog.visible"
			:type="dialog.properties.type"
			@close="dialog.close"
		/>

		<ContextMenu v-if="!isMobile" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ConditionKind, type IPushRule, PushRuleActionName, PushRuleKind } from 'matrix-js-sdk';
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { type NavigationFailure, type RouteParamValue, type RouteRecordNameGeneric, isNavigationFailure, useRouter } from 'vue-router';

	import ContextMenu from '@hub-client/components/elements/ContextMenu.vue';
	// Components
	import SettingsDialog from '@hub-client/components/forms/SettingsDialog.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import HubSidebar from '@hub-client/components/ui/HubSidebar.vue';

	// Composables
	import { useUnreadAggregate } from '@hub-client/composables/unreadAggregate.composable';
	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { PubHubsInvisibleMsgType, PubHubsMgType } from '@hub-client/logic/core/events';
	import { createLogger } from '@hub-client/logic/logging/Logger';
	import { hubId } from '@hub-client/logic/utils/hubId';

	// Models
	import { QueryParameterKey } from '@hub-client/models/constants';

	// Stores
	import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
	import { useDialog } from '@hub-client/stores/dialog';
	import { type HubInformation } from '@hub-client/stores/hub-settings';
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { Message, MessageBoxType, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const logger = createLogger('App');

	const { locale, availableLocales } = useI18n();
	const router = useRouter();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const user = useUser();
	const rooms = useRooms();
	const messagebox = useMessageBox();
	const dialog = useDialog();
	const pubhubs = usePubhubsStore();
	const settingsDialog = ref(false);
	const setupReady = ref(false);
	const pendingRouteFromParent = ref<RouteParamValue | null>(null);
	const isMobile = computed(() => settings.isMobileState);
	const { scrollToStart } = useGlobalScroll();

	// Aggregate unread state for this hub. The composable hydrates the
	// persisted cache and keeps `unreadState` in sync with unreadCountVersion
	// bumps from the rooms store.
	const { unreadState, setupUnreadAggregateTracking } = useUnreadAggregate();

	/**
	 * When this hub client is running inside the global client it is, by
	 * definition, the currently active hub — its miniclient sibling is in
	 * "linked" mode and does not run its own sync, and just mirrors what we
	 * push to the parent. Fire AggregateUnreadState on every state change;
	 * and on the read → unread transition also fire UnreadMessages so the
	 * parent shows a desktop notification for this hub (that trigger used
	 * to live in the miniclient, and moved here because a linked miniclient
	 * no longer sees the transition itself).
	 *
	 * Solo mode is skipped: the messagebox is a no-op there and there's no
	 * parent to forward to. See the "Solo-mode desktop notifications for
	 * hub client" follow-up task.
	 */
	watch(unreadState, (state, previous) => {
		if (hubSettings.isSolo || !hubId) return;
		messagebox.sendMessage(new Message(MessageType.AggregateUnreadState, { hubId, state }));
		if (state === 'unread' && previous !== 'unread') {
			messagebox.sendMessage(new Message(MessageType.UnreadMessages));
		}
	});

	onMounted(async () => {
		logger.debug('App.vue onMounted');

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

		// When running solo (no global client wrapper), detect mobile state directly.
		// Otherwise, listen for viewport updates from the global client.
		if (hubSettings.isSolo) {
			settings.startListeningMobile();
		} else {
			window.parent.postMessage({ type: 'viewport-ready' }, '*');
			window.addEventListener('message', handleViewport);
		}

		await startMessageBox();

		// check if hash doesn't start with hub,
		// then it is running only the hub-client, so we need to do some checks
		if (!window.location.hash.startsWith('#/hub/')) {
			// With sliding-sync, loading is faster.
			await pubhubs.login();
			await setupUnreadAggregateTracking();
			setupReady.value = true;
			void addPushRules();
		}

		if (!user.isLoggedIn) {
			// only needed when loggedIn (then there are user settings to setup)
			setupReady.value = true;
		}

		if (pendingRouteFromParent.value) {
			await navigateFromParent(pendingRouteFromParent.value);
			pendingRouteFromParent.value = null;
		}

		logger.debug('App.vue onMounted done');
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
				//TODO: content from MessageType.RoomChange is roomId? maybe we can rename content to roomId.
				const content = message.content as RouteParamValue;
				if (!setupReady.value || !user.isLoggedIn) {
					pendingRouteFromParent.value = content;
					return;
				}
				await navigateFromParent(content);
			});

			// Listen to event change
			messagebox.addCallback('parentFrame', MessageType.EventChange, (message: Message) => {
				const url = message.content as string;

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

			// Receive context menu selection from global-client
			messagebox.addCallback('parentFrame', MessageType.ContextMenuSelect, (message: Message) => {
				useContextMenuStore().selectByIndex(message.content as number);
			});

			// Receive context menu close from global-client (mobile)
			messagebox.addCallback('parentFrame', MessageType.ContextMenuClose, () => {
				useContextMenuStore().close();
			});

			// Ask for hubinformation
			messagebox.sendMessage(new Message(MessageType.SendHubInformation));
		}
	}

	async function navigateFromParent(content: RouteParamValue) {
		let navigationResult: NavigationFailure | void | undefined = undefined;
		// If content is a roomId then it has a format that starts with !.
		if (content.startsWith('!')) {
			navigationResult = await router.push({ name: 'room', params: { id: content } });
		} else {
			navigationResult = await router.push({ name: content as RouteRecordNameGeneric });
		}

		// FALLBACK to homepage if there is a navigation failure.
		if (navigationResult && isNavigationFailure(navigationResult)) {
			await router.push({ name: 'home' });
		}
	}

	async function addPushRules() {
		// Add a pushrule to make sure that events that modify a voting widget (poll or date picker) do not trigger unread messages and mentions.
		const votingWidgetPushrule: IPushRule = {
			actions: [],
			conditions: [{ kind: ConditionKind.EventMatch, key: 'type', pattern: PubHubsInvisibleMsgType.VotingWidgetModify }],
			default: false,
			enabled: true,
			rule_id: 'votingwidgetmodify',
		};
		const upsertPushRule = async (kind: PushRuleKind, ruleId: string, pushrule: IPushRule) => {
			try {
				await pubhubs.client.deletePushRule('global', kind, ruleId);
			} catch {
				logger.warn('Failed to delete push rule', { kind, ruleId });
			}

			try {
				await pubhubs.client.addPushRule('global', kind, ruleId, pushrule);
			} catch (error) {
				logger.warn('Failed to upsert push rule', { kind, ruleId, error });
			}
		};

		await upsertPushRule(PushRuleKind.Override, 'votingwidgetmodify', votingWidgetPushrule);

		if (settings.isFeatureEnabled(FeatureFlag.whisper)) {
			const whisperNotifyForMePushrule: IPushRule = {
				actions: [PushRuleActionName.Notify],
				conditions: [
					{ kind: ConditionKind.EventMatch, key: 'content.msgtype', pattern: PubHubsMgType.WhisperMessage },
					{ kind: ConditionKind.EventMatch, key: 'content.whisper_to', pattern: user.userId ?? '' },
				],
				default: false,
				enabled: true,
				rule_id: 'whisper_notify_for_me',
			};
			const whisperSuppressPushrule: IPushRule = {
				actions: [],
				conditions: [{ kind: ConditionKind.EventMatch, key: 'content.msgtype', pattern: PubHubsMgType.WhisperMessage }],
				default: false,
				enabled: true,
				rule_id: 'whisper_message',
			};

			// Override rules are evaluated before underride rules. i.e., notification / unread has priority.
			// If there is a unread notification it is show and when there is a whisper only it will only run whisper rule.
			await upsertPushRule(PushRuleKind.Override, 'whisper_notify_for_me', whisperNotifyForMePushrule);
			await upsertPushRule(PushRuleKind.Underride, 'whisper_message', whisperSuppressPushrule);
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
</script>
