<template>
	<div class="flex h-full flex-col py-200">
		<SidebarHeader :title="t('roles.details')" />

		<div class="flex flex-1 flex-col gap-400 overflow-y-auto p-200">
			<!-- User info -->
			<div class="flex flex-col gap-200">
				<div class="flex items-center gap-200">
					<Avatar
						:avatar-url="userStore.userAvatar(role.userId)"
						:user-id="role.userId"
						size="lg"
					/>
					<div class="flex min-w-0 flex-col">
						<p class="truncate text-lg font-semibold">{{ role.displayName }}</p>
						<p class="text-on-surface-dim truncate text-sm italic">{{ role.userId }}</p>
					</div>
				</div>
			</div>

			<!-- Room info -->
			<CollapsibleHeader
				:label="t('roles.room')"
				:collapsible="false"
			>
				<p>{{ role.roomName }}</p>
			</CollapsibleHeader>

			<!-- Type -->
			<CollapsibleHeader
				:label="t('roles.type')"
				:collapsible="false"
			>
				<span
					class="py-050 w-fit rounded-full px-150 text-sm"
					:class="typeClasses"
				>
					{{ typeLabel }}
				</span>
			</CollapsibleHeader>

			<!-- Status (for invitations) -->
			<CollapsibleHeader
				v-if="role.status"
				:label="t('roles.status')"
				:collapsible="false"
			>
				<span
					class="py-050 w-fit rounded-full px-150 text-sm"
					:class="statusClasses"
				>
					{{ statusLabel }}
				</span>
			</CollapsibleHeader>

			<!-- Disclosed attributes (for invitations with disclosed status) -->
			<CollapsibleHeader
				v-if="role.attributes && role.attributes.length > 0"
				:label="t('roles.disclosed_attributes')"
				:collapsible="false"
			>
				<div class="bg-surface-base rounded-base flex flex-col gap-100 p-200">
					<div
						v-for="attr in role.attributes"
						:key="attr.id"
						class="flex flex-col"
					>
						<span class="text-on-surface-dim text-xs">{{ attr.id }}</span>
						<span class="text-sm">{{ attr.rawvalue }}</span>
					</div>
				</div>
			</CollapsibleHeader>
		</div>

		<!-- Actions -->
		<div class="border-surface-elevated flex flex-col items-center gap-200 border-t p-200">
			<!-- Steward invitation actions -->
			<template v-if="role.type === 'steward-invitation'">
				<Button
					v-if="role.status === 'disclosed'"
					variant="primary"
					class="w-full"
					@click="$emit('promote-steward')"
				>
					{{ t('roles.promote_to_steward') }}
				</Button>
				<Button
					variant="secondary"
					class="w-full"
					@click="$emit('reject')"
				>
					{{ t('roles.reject_invitation') }}
				</Button>
			</template>

			<!-- Expert invitation actions -->
			<template v-if="role.type === 'expert-invitation'">
				<Button
					v-if="role.status === 'disclosed'"
					variant="primary"
					class="w-full"
					@click="$emit('promote-expert')"
				>
					{{ t('roles.promote_to_expert') }}
				</Button>
				<Button
					variant="secondary"
					class="w-full"
					@click="$emit('reject')"
				>
					{{ t('roles.reject_invitation') }}
				</Button>
			</template>

			<!-- Active steward actions -->
			<template v-if="role.type === 'active-steward'">
				<Button
					variant="secondary"
					class="w-full"
					@click="$emit('demote')"
				>
					{{ t('roles.demote_steward') }}
				</Button>
			</template>

			<!-- Active expert actions -->
			<template v-if="role.type === 'active-expert'">
				<Button
					variant="secondary"
					class="w-full"
					@click="$emit('remove-expert')"
				>
					{{ t('roles.remove_expert') }}
				</Button>
			</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { type TRoleEntry } from '@hub-client/composables/manage-roles.composable';
	import { useRoleDisplay } from '@hub-client/composables/roles-display.composable';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps<{
		role: TRoleEntry;
	}>();

	defineEmits<{
		demote: [];
		'promote-steward': [];
		'promote-expert': [];
		reject: [];
		'remove-expert': [];
	}>();

	const { t } = useI18n();
	const userStore = useUser();
	const { getTypeLabel, getTypeClasses, getStatusLabel, getStatusClasses } = useRoleDisplay();

	const typeLabel = computed(() => getTypeLabel(props.role.type));
	const typeClasses = computed(() => getTypeClasses(props.role.type));
	const statusLabel = computed(() => getStatusLabel(props.role.status));
	const statusClasses = computed(() => getStatusClasses(props.role.status));
</script>
