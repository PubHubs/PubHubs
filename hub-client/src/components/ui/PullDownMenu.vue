<template>
	<div
		v-click-outside="close"
		class="bg-surface-elevated relative flex w-full items-center rounded-md"
		role="menubar"
	>
		<div class="bg-surface-elevated top-050 absolute w-full cursor-pointer rounded-md whitespace-nowrap">
			<div v-show="open">
				<div
					v-for="(option, index) in options"
					:key="index"
					class="text-on-surface-dim hover:bg-surface-elevated gap-050 flex items-center rounded-md pl-100 hover:text-white"
					:class="selectedClass(index)"
					@click="select(index)"
				>
					<template v-if="toggleOrder">
						<template v-if="index === selectedIndex">
							<Icon
								v-if="selectedOrder === SortOrder.asc"
								type="arrow-down"
							/>
							<Icon
								v-else
								type="arrow-up"
							/>
						</template>
						<template v-else>
							<Icon
								v-if="selectedOrder === SortOrder.asc"
								type="arrow-up"
							/>
							<Icon
								v-else
								type="arrow-down"
							/>
						</template>
					</template>
					<span class="grow">
						{{ $t(option as string) }}
					</span>
				</div>
			</div>
			<div
				v-show="!open"
				class="pl-100"
				@click="toggle"
			>
				<span
					v-if="!changed"
					class="text-label-small"
					>{{ title }}</span
				>
				<div
					v-else
					class="gap-050 pt-050 flex items-center"
				>
					<template v-if="toggleOrder">
						<Icon
							v-if="selectedOrder === SortOrder.asc"
							type="arrow-up"
							size="sm"
						/>
						<Icon
							v-else
							type="arrow-down"
							size="sm"
						/>
					</template>
					<span class="text-label-small grow">{{ $t(options[selectedIndex] as string) }}</span>
				</div>
			</div>
		</div>
		<div
			class="right-050 absolute cursor-pointer rounded-md bg-transparent"
			@click="toggle"
		>
			<Icon
				size="sm"
				type="caret-down"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
	import { computed, ref } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	import { type SortOption, SortOrder } from '@hub-client/models/components/SortOrder';

	const props = withDefaults(defineProps<Props>(), {
		toggleOrder: false,
	});

	const emit = defineEmits(['select']);

	interface Props {
		title: string;
		options: Array<string>;
		selected: number | SortOption;
		toggleOrder?: boolean;
	}

	const open = ref(false);
	const changed = ref(false);

	const selectedIndex = computed(() => {
		if (typeof props.selected === 'number') {
			return props.selected as number;
		}
		return props.selected.index as number;
	});

	const selectedOrder = computed(() => {
		if (typeof props.selected === 'number') {
			return SortOrder.asc;
		}
		return props.selected.order as SortOrder;
	});

	const selectedClass = (index: number): string => {
		if (index === selectedIndex.value) {
			return 'dark:text-white text-on-surface-dim';
		}
		return '';
	};

	const select = (index: number) => {
		changed.value = true;
		if (props.toggleOrder) {
			let result = { index: index, order: selectedOrder.value };
			if (index === selectedIndex.value) {
				result.order = -result.order;
			}
			emit('select', result);
		} else {
			emit('select', index);
		}
		close();
	};

	const toggle = () => {
		open.value = !open.value;
	};

	const close = () => {
		open.value = false;
	};
</script>
