<template>
	<div
		ref="rootEl"
		class="flex w-full flex-col"
	>
		<div
			class="flex flex-col gap-y-4 pb-4"
			:class="isMobile ? 'px-3' : 'px-4'"
		>
			<TextField
				v-model="search"
				icon="magnifying-glass"
				type="search"
				:placeholder="placeholderText"
			/>

			<!-- Chip filter buttons and actions -->
			<div
				v-if="chipFilters.length > 0 || $slots.actions"
				class="flex items-start justify-between gap-4"
			>
				<div
					v-if="chipFilters.length > 0"
					class="flex shrink-0 flex-wrap items-center gap-2 p-[3px]"
					role="group"
					:aria-label="t('others.search')"
				>
					<Button
						v-for="chip in chipFilters"
						:key="chip.label"
						:aria-label="chip.label"
						:aria-pressed="activeChips.has(chip.label)"
						:icon="activeChips.has(chip.label) ? 'check' : undefined"
						:variant="activeChips.has(chip.label) ? 'primary' : 'secondary'"
						size="sm"
						type="button"
						@click="toggleChip(chip.label)"
					>
						{{ chip.label }}
					</Button>
				</div>
				<div
					v-if="$slots.actions"
					class="shrink-0"
				>
					<slot name="actions" />
				</div>
			</div>
		</div>

		<!-- Slot for filtered items -->
		<template v-if="(!hideUntilSearch || search.length > 0) && sortedItems.length > 0">
			<slot
				name="filtered"
				:items="paginatedItems"
			/>
			<div
				v-if="totalPages > 1"
				class="flex items-center gap-4 py-4"
				:class="isMobile ? 'justify-start px-3' : 'justify-center px-4'"
			>
				<Button
					variant="secondary"
					size="sm"
					icon="caret-left"
					:disabled="currentPage === 1"
					@click="prevPage"
				/>
				<p class="text-on-surface-dim text-sm">
					{{ t('others.page_x_of_y', [currentPage, totalPages]) }}
				</p>
				<Button
					variant="secondary"
					size="sm"
					icon="caret-right"
					:disabled="currentPage === totalPages"
					@click="nextPage"
				/>
			</div>
		</template>
		<template v-else-if="search.length > 0 || activeChips.size > 0">
			<p
				class="text-on-surface-dim text-center"
				role="status"
			>
				{{ t('others.search_nothing_found') }}
			</p>
		</template>
		<p
			v-else-if="emptyText && items.length === 0"
			class="text-on-surface-dim text-center"
			role="status"
		>
			{{ emptyText }}
		</p>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	interface ChipFilter {
		label: string;
		predicate: (item: Record<string, unknown>) => boolean;
	}

	const props = withDefaults(
		defineProps<{
			items?: Record<string, unknown>[];
			filterKeys?: string[];
			chipFilters?: ChipFilter[];
			placeholder?: string;
			sortby?: string | null;
			hideUntilSearch?: boolean;
			emptyText?: string;
		}>(),
		{
			items: () => [],
			filterKeys: () => [],
			chipFilters: () => [],
			placeholder: 'Search',
			sortby: null,
			hideUntilSearch: false,
			emptyText: '',
		},
	);

	defineExpose({ clearSearch });

	const activeChips = ref(new Set<string>());
	const search = ref('');
	const currentPage = ref(1);
	const { t } = useI18n();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState ?? false);

	const placeholderText = computed(() => props.placeholder ?? t('others.search'));

	const toggleChip = (label: string) => {
		if (activeChips.value.has(label)) {
			activeChips.value.delete(label);
		} else {
			activeChips.value.add(label);
		}
	};

	const filteredItems = computed(() => {
		const term: string = search.value.trim().toLowerCase();

		return props.items.filter((item: Record<string, unknown>) => {
			if (activeChips.value.size > 0) {
				const matching = props.chipFilters.some((chip: ChipFilter) => activeChips.value.has(chip.label) && chip.predicate(item));
				if (!matching) return false;
			}

			if (!term) return true;

			return props.filterKeys.some((key: string) => {
				const val = item[key];
				return val != null && String(val).toLowerCase().includes(term);
			});
		});
	});

	const sortedItems = computed(() => {
		if (!props.sortby) return filteredItems.value;

		return [...filteredItems.value].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
			const valA = a[props.sortby!];
			const valB = b[props.sortby!];

			if (valA == null) return 1;
			if (valB == null) return -1;

			if (typeof valA === 'string' && typeof valB === 'string') {
				return valA.localeCompare(valB);
			}

			return valA > valB ? 1 : valA < valB ? -1 : 0;
		});
	});

	const ROW_HEIGHT = 68;
	const SEARCH_H = 140;
	const PAGINATION_H = 44;
	const HEADER_ROW_H = 33;

	const rootEl = ref<HTMLElement | null>(null);
	const fillContainerHeight = ref(0);
	let resizeObserver: ResizeObserver | null = null;

	onMounted(() => {
		const el = rootEl.value?.parentElement;
		if (!el) return;
		fillContainerHeight.value = el.clientHeight;
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				fillContainerHeight.value = entry.contentRect.height;
			}
		});
		resizeObserver.observe(el);
	});

	onUnmounted(() => {
		resizeObserver?.disconnect();
	});

	const fillPageSize = computed(() => {
		if (isMobile.value) return 10;
		const available = fillContainerHeight.value - SEARCH_H - PAGINATION_H - HEADER_ROW_H;
		if (available <= 0) return 10;
		return Math.max(5, Math.floor(available / ROW_HEIGHT));
	});

	const totalPages = computed(() => Math.max(1, Math.ceil(sortedItems.value.length / fillPageSize.value)));

	const paginatedItems = computed(() => {
		const start = (currentPage.value - 1) * fillPageSize.value;
		return sortedItems.value.slice(start, start + fillPageSize.value);
	});

	function prevPage() {
		if (currentPage.value > 1) currentPage.value--;
	}

	function nextPage() {
		if (currentPage.value < totalPages.value) currentPage.value++;
	}

	// Reset to page 1 when search or filters change
	watch([search, activeChips], () => {
		currentPage.value = 1;
	});

	function clearSearch() {
		search.value = '';
		currentPage.value = 1;
	}
</script>
