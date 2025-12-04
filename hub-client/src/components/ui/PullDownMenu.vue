<template>
	<div class="bg-surface-low relative flex w-full items-center rounded-md" v-click-outside="close" role="menubar">
		<div class="bg-surface-low absolute top-1 w-full cursor-pointer rounded-md whitespace-nowrap">
			<div v-show="open">
				<div v-for="(option, index) in options" class="text-on-surface-dim hover:bg-on-surface-variant flex items-center gap-1 rounded-md pl-2 hover:text-white" :class="selectedClass(index)" @click="select(index)">
					<template v-if="toggleOrder">
						<template v-if="index === selectedIndex">
							<Icon v-if="selectedOrder === SortOrder.asc" type="arrow-down"></Icon>
							<Icon v-else type="arrow-up"></Icon>
						</template>
						<template v-else>
							<Icon v-if="selectedOrder === SortOrder.asc" type="arrow-up"></Icon>
							<Icon v-else type="arrow-down"></Icon>
						</template>
					</template>
					<span class="flex-grow">
						{{ $t(option as string) }}
					</span>
				</div>
			</div>
			<div v-show="!open" class="pl-2" @click="toggle">
				<span v-if="!changed">{{ title }}</span>
				<div v-else class="flex items-center gap-1">
					<template v-if="toggleOrder">
						<Icon v-if="selectedOrder === SortOrder.asc" type="arrow-up"></Icon>
						<Icon v-else type="arrow-down"></Icon>
					</template>
					<span class="flex-grow">{{ $t(options[selectedIndex] as string) }}</span>
				</div>
			</div>
		</div>
		<div class="absolute right-1 cursor-pointer rounded-md bg-transparent" @click="toggle">
			<Icon type="caret-down" size="md"></Icon>
		</div>
	</div>
</template>

<script setup lang="ts">
	import Icon from '../elements/Icon.vue';
	import { computed, ref } from 'vue';

	import { SortOption, SortOrder } from '@hub-client/models/components/SortOrder';

	const emit = defineEmits(['select']);

	interface Props {
		title: string;
		options: Array<string>;
		selected: number | SortOption;
		toggleOrder?: boolean;
	}

	const props = withDefaults(defineProps<Props>(), {
		toggleOrder: false,
	});

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
			return 'dark:text-white text-on-surface-variant';
		}
		return '';
	};

	const select = (index: Number) => {
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
