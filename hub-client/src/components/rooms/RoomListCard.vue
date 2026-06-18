<template>
	<!-- Mobile: card layout -->
	<div
		v-if="isMobile"
		class="rounded-base bg-surface-base flex flex-col gap-100 p-200"
		:title="roomId"
		@click="$emit('click')"
	>
		<div class="flex items-center gap-150">
			<Icon
				:type="roomType === 'public' ? 'chats-circle' : 'shield'"
				class="shrink-0"
			/>
			<p class="truncate font-semibold">
				{{ name }}
			</p>
		</div>
		<p
			v-if="topic"
			class="text-on-surface-dim truncate text-sm italic first-letter:uppercase"
		>
			{{ topic }}
		</p>
		<div class="gap-y-050 flex flex-wrap items-baseline gap-x-200 text-sm">
			<span>
				<span class="text-on-surface-dim">{{ t('admin.room_type') }}: </span>
				<span class="first-letter:uppercase">{{ roomTypeDisplay }}</span>
			</span>
			<span v-if="yiviAttributes">
				<span class="text-on-surface-dim">{{ t('rooms.yivi_attributes') }}: </span>
				<span class="first-letter:uppercase">{{ yiviAttributeNames }}</span>
			</span>
			<span v-if="numJoinedMembers !== undefined">
				<span class="text-on-surface-dim">{{ t('rooms.member_count') }}: </span>
				<span>{{ numJoinedMembers }}</span>
			</span>
		</div>
	</div>

	<!-- Desktop: grid cells (each is a direct child of the parent grid) -->
	<template v-else>
		<TableRowCell
			class="flex min-w-0 items-center gap-100"
			:title="name"
		>
			<Icon
				:type="roomType === 'public' ? 'chats-circle' : 'shield'"
				class="shrink-0"
			/>
			<p class="truncate font-semibold">
				{{ name }}
			</p>
		</TableRowCell>
		<TableRowCell
			class="min-w-0"
			:title="topic || '-'"
		>
			<p class="text-on-surface-dim truncate text-sm italic first-letter:uppercase">
				{{ topic || '-' }}
			</p>
		</TableRowCell>
		<TableRowCell
			class="flex min-w-0 items-center"
			:title="roomTypeDisplay"
		>
			<span class="text-on-surface-dim truncate italic first-letter:uppercase">
				{{ roomTypeDisplay }}
			</span>
		</TableRowCell>
		<TableRowCell
			class="flex items-center gap-100"
			:title="yiviAttributes ? yiviAttributeNames : '-'"
		>
			<span class="gap-050 flex shrink-0 items-center">
				<p
					v-if="yiviAttributes"
					class="first-letter:uppercase"
				>
					{{ yiviAttributeNames }}
				</p>
				<p v-else>-</p>
			</span>
		</TableRowCell>
		<TableRowCell
			class="flex items-center gap-100"
			:title="numJoinedMembers !== undefined ? String(numJoinedMembers) : '-'"
		>
			<span class="gap-050 flex shrink-0 items-center">
				<p v-if="numJoinedMembers !== undefined">{{ numJoinedMembers }}</p>
				<p v-else>-</p>
			</span>
		</TableRowCell>
	</template>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TableRowCell from '@hub-client/components/rooms/TableRowCell.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';
	import { useYivi } from '@hub-client/stores/yivi';

	// Props
	interface YiviAttributeEntry {
		profile: boolean;
		accepted_values: Array<string>;
	}

	const props = defineProps<{
		roomId: string;
		name: string;
		roomType: 'public' | 'secured';
		topic?: string;
		roomTypeValue?: string;
		userTxt?: string;
		numJoinedMembers?: number;
		yiviAttributes?: Record<string, YiviAttributeEntry>;
	}>();

	defineEmits<{
		click: [];
	}>();

	const { t } = useI18n();
	const settings = useSettings();
	const yiviStore = useYivi();

	const roomTypeDisplay = computed(() => {
		const prefixKey = props.roomType === 'public' ? 'rooms.room_type_prefix_public' : 'rooms.room_type_prefix_secured';
		const suffixKey = props.roomTypeValue === 'ph.forum-room' ? 'rooms.room_type_suffix_forum' : 'rooms.room_type_suffix_default';
		return `${t(prefixKey)} ${t(suffixKey)}`;
	});

	const yiviAttributeNames = computed(() => {
		if (!props.yiviAttributes) return '';
		const yiviAttrs = yiviStore.getAttributes(t);
		return Object.keys(props.yiviAttributes)
			.map((key) => {
				const found = yiviAttrs.find((a) => a.attribute === key);
				return found ? found.label : key;
			})
			.join(', ');
	});

	const isMobile = computed(() => settings.isMobileState);
</script>
