<template>
	<div class="flex h-full flex-col py-4">
		<SidebarHeader :title="displayName || t('admin.user_details')" />
		<div
			v-if="userId"
			class="flex flex-1 flex-col items-center justify-center gap-4 px-4"
		>
			<button
				v-if="isAdmin"
				class="hover:bg-surface-low flex items-center gap-2 rounded-md p-2 transition-colors hover:cursor-pointer"
				@click="emit('edit')"
			>
				<Icon type="pencil-simple" />
			</button>
			<button
				v-if="userId !== currentUserId"
				class="hover:bg-surface-low flex items-center gap-2 rounded-md p-2 transition-colors hover:cursor-pointer"
				@click="emit('disclose')"
			>
				<Icon type="lock-open" />
			</button>
		</div>
		<div
			v-else
			class="flex h-full items-center justify-center px-4"
		>
			<p class="text-on-surface-dim text-center italic">
				{{ t('admin.select_user_placeholder') }}
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	// Props
	import { type PropType } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	import { type Administrator } from '@hub-client/models/hubmanagement/models/admin';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	defineProps({
		userId: { type: String, default: '' },
		displayName: { type: String, default: '' },
		administrator: { type: Object as PropType<Administrator | null>, default: null },
		isAdmin: { type: Boolean, default: false },
	});

	const emit = defineEmits<{
		edit: [];
		disclose: [];
	}>();

	const currentUserId = useUser().userId;
	const { t } = useI18n();
</script>
