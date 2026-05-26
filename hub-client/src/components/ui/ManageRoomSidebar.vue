<template>
	<div class="flex h-full flex-col py-4">
		<SidebarHeader :title="roomName || t('admin.room_details')" />
		<div
			v-if="roomId"
			class="flex flex-1 flex-col items-center justify-center gap-4 px-4"
		>
			<button
				v-if="isRoomAdmin"
				class="hover:bg-surface-low flex items-center gap-2 rounded-md p-2 transition-colors hover:cursor-pointer"
				@click="emit('edit')"
			>
				<Icon type="pencil-simple" />
			</button>
			<button
				v-if="isHubAdmin"
				class="hover:bg-surface-low text-accent-red flex items-center gap-2 rounded-md p-2 transition-colors hover:cursor-pointer"
				@click="emit('remove')"
			>
				<Icon type="trash" />
			</button>
			<button
				v-if="!isRoomAdmin"
				class="hover:bg-surface-low flex items-center gap-2 rounded-md p-2 transition-colors hover:cursor-pointer"
				@click="emit('promote')"
			>
				<Icon type="arrow-circle-up" />
			</button>
		</div>
		<div
			v-else
			class="flex h-full items-center justify-center px-4"
		>
			<p class="text-on-surface-dim text-center italic">
				{{ t('admin.select_room_placeholder') }}
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Props
	defineProps({
		roomId: { type: String, default: '' },
		roomName: { type: String, default: '' },
		isRoomAdmin: { type: Boolean, default: false },
		isHubAdmin: { type: Boolean, default: false },
	});

	const emit = defineEmits<{
		edit: [];
		remove: [];
		promote: [];
	}>();

	const { t } = useI18n();
</script>
