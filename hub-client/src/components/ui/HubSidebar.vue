<template>
	<HeaderFooter
		class="relative shrink-0"
		:class="isMobile && !hubSettings.isSolo ? 'w-[calc(50%-40px)]!' : 'flex max-w-[280px]'"
	>
		<template #header>
			<div class="flex h-full w-full items-center justify-between">
				<div
					v-context-menu="(evt: Event) => openMenu(evt as MouseEvent, [{ label: t('menu.copy_hub_url'), icon: 'copy', onClick: () => copyHubUrl() }])"
					class="group relative flex items-center gap-2"
				>
					<H2 class="font-headings text-h2 text-on-surface font-semibold">{{ hubSettings.hubName }}</H2>
				</div>
				<div class="flex items-center gap-2">
					<!-- TODO: change the v-if to 'isModerator' once steward screens are implemented -->
					<GlobalbarButton
						v-if="isHubAdmin"
						:type="showModerationMenu ? 'x' : 'circles-three-plus'"
						:selected="showModerationMenu"
						:aria-label="t(showModerationMenu ? 'menu.close_admin_menu' : 'menu.admin_tools')"
						@click="toggleModerationMenu"
					/>
					<Notification />
				</div>
			</div>
		</template>

		<div
			class="flex flex-col gap-8 p-3 md:p-4"
			role="menu"
		>
			<template v-if="!showModerationMenu">
				<section class="flex flex-col gap-2">
					<div
						class="bg-surface text-hub-text rounded-base flex h-16 items-center justify-between overflow-hidden py-2 pr-4 pl-2"
						role="complementary"
					>
						<div class="flex w-full items-center gap-2 truncate">
							<Avatar
								:avatar-url="user.userAvatar(user.userId!) ?? user.avatarUrl"
								:user-id="user.userId!"
							/>
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
							@click="handleEditUserInfo"
						/>
					</div>

					<!-- General menu -->
					<Menu>
						<MenuItem
							v-for="(item, index) in menu.getMenu"
							:key="index"
							:to="item.to"
							:icon="item.icon"
							@click="hubSettings.hideBar()"
							>{{ t(item.key) }}</MenuItem
						>
					</Menu>
				</section>

				<!-- Public rooms -->
				<CollapsibleHeader
					v-if="hasPublicRooms"
					:label="t('admin.public_rooms')"
				>
					<RoomList :room-types="PublicRooms" />
				</CollapsibleHeader>

				<!-- Secured rooms -->
				<CollapsibleHeader
					v-if="hasSecuredRooms"
					:label="t('admin.secured_rooms')"
					:title="t('admin.secured_rooms_tooltip')"
				>
					<RoomList :room-types="SecuredRooms" />
				</CollapsibleHeader>
			</template>

			<template v-else>
				<!-- Back button -->
				<button
					type="button"
					class="text-on-surface-dim hover:bg-surface-base border-on-surface-disabled -m-3 flex items-center gap-2 border-b p-3 transition-colors hover:cursor-pointer md:-m-4 md:p-4"
					@click="showModerationMenu = false"
				>
					<Icon type="caret-left" />
					<span class="text-body-small">{{ t('menu.back_to_rooms') }}</span>
				</button>

				<!-- Overview -->
				<CollapsibleHeader :label="t('menu.overview')">
					<Menu>
						<MenuItem
							v-if="isHubAdmin"
							:to="{ name: 'hub-settings' }"
							icon="sliders-horizontal"
							@click="hubSettings.hideBar()"
							>{{ t('menu.admin_tools_hub_settings') }}</MenuItem
						>
						<!-- <MenuItem
							v-if="isHubAdmin"
							:to="{ name: 'nop' }"
							icon="shield"
							@click="hubSettings.hideBar()"
							>{{ t('menu.admin_dashboard') }}</MenuItem
						> -->
						<!-- <MenuItem
							:to="{ name: 'nop' }"
							icon="shield"
							@click="hubSettings.hideBar()"
							>{{ t('menu.steward_dashboard') }}</MenuItem
						> -->
					</Menu>
				</CollapsibleHeader>

				<!-- Moderation -->
				<!-- <CollapsibleHeader :label="t('menu.moderation')">
					<Menu>
						<MenuItem
							:to="{ name: 'nop' }"
							icon="warning"
							@click="hubSettings.hideBar()"
							>{{ t('menu.reports') }}</MenuItem
						>
						<MenuItem
							:to="{ name: 'nop' }"
							icon="file"
							@click="hubSettings.hideBar()"
							>{{ t('menu.audit_log') }}</MenuItem
						>
					</Menu>
				</CollapsibleHeader> -->

				<!-- Manage -->
				<CollapsibleHeader
					v-if="isHubAdmin"
					:label="t('menu.manage')"
				>
					<Menu>
						<MenuItem
							:to="{ name: 'admin' }"
							icon="chats-circle"
							@click="hubSettings.hideBar()"
							>{{ t('menu.admin_tools_rooms') }}</MenuItem
						>
						<MenuItem
							:to="{ name: 'manage-users' }"
							icon="users"
							@click="hubSettings.hideBar()"
							>{{ t('menu.admin_tools_users') }}</MenuItem
						>
					</Menu>
				</CollapsibleHeader>
			</template>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomList from '@hub-client/components/rooms/RoomList.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import GlobalbarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import Menu from '@hub-client/components/ui/Menu.vue';
	import MenuItem from '@hub-client/components/ui/MenuItem.vue';
	import Notification from '@hub-client/components/ui/Notification.vue';

	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	// Composables
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useClipboard } from '@hub-client/composables/useClipboard';
	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';

	// Models
	import { PublicRooms, SecuredRooms } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { useMenu } from '@hub-client/stores/menu';
	import { useNotifications } from '@hub-client/stores/notifications';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const emit = defineEmits<{
		openSettings: [];
	}>();

	const { t } = useI18n();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const user = useUser();
	const rooms = useRooms();
	const menu = useMenu();
	const roles = useRoles();
	const notifications = useNotifications();
	const { copyHubUrl } = useClipboard();
	const { openMenu } = useContextMenu();
	const { scrollToEnd } = useGlobalScroll();

	const showModerationMenu = ref(false);

	const isMobile = computed(() => settings.isMobileState);
	const hasPublicRooms = computed(() => rooms.loadedPublicRooms.length > 0 || !rooms.roomsLoaded);
	const hasSecuredRooms = computed(() => rooms.loadedSecuredRooms.length > 0 || notifications.notifications.length > 0 || !rooms.roomsLoaded);

	const isHubAdmin = computed(() => roles.userIsHubAdmin());
	const isModerator = computed(() => roles.userIsHubStewardOrHigher());

	// If the user loses moderator status, drop back to the rooms view.
	watch(isModerator, (canModerate) => {
		if (!canModerate) showModerationMenu.value = false;
	});

	function toggleModerationMenu() {
		showModerationMenu.value = !showModerationMenu.value;
	}

	function handleEditUserInfo() {
		scrollToEnd();
		emit('openSettings');
		hubSettings.hideBar();
	}
</script>
