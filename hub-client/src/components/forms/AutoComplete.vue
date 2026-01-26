<template>
	<div ref="autocompleteRef" class="relative w-full" @keydown.arrow-down.prevent="cursorDown" @keydown.tab.prevent="cursorDown" @keydown.arrow-up.prevent="cursorUp" @keydown.enter.stop="onEnter" @keydown.esc.stop="onEscape">
		<input
			v-if="dropdown"
			ref="inputRef"
			type="text"
			v-model="search"
			class="bg-background text-label placeholder:text-surface-subtle focus:ring-accent-primary h-10 w-full rounded-lg px-2 py-1"
			:placeholder="''"
			:disabled="disabled"
			:maxlength="maxlength"
		/>
		<ul v-if="results.length > 0 && dropdown" class="bg-background absolute z-50 w-full overflow-y-scroll rounded-lg px-2 py-1 shadow-md">
			<li v-for="(item, index) in results" :key="index" @click="selectItem(item)" class="cursor-pointer" :class="{ 'bg-surface-low': cursor === index }">
				{{ getLabel(item) }}
			</li>
		</ul>
		<div v-if="!dropdown" @click="openDropdown" class="bg-background flex h-10 w-full cursor-pointer flex-row items-center justify-between gap-x-2 rounded-lg border px-2 py-1">
			<P v-if="props.modelValue">{{ displayValue }}</P>
			<P v-else>{{ t(props.default) }}</P>
			<Icon type="caret-down"></Icon>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, nextTick, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	import Icon from '@hub-client/components/elements/Icon.vue';

	type Option = string | { value: string; label: string };

	type Props = {
		options: Option[];
		modelValue: string;
		dropdown?: string | null;
		disabled?: boolean;
		maxlength?: number;
		default?: string; // Default placeholder text
		allowCustom?: boolean; // Allow custom values not in options
	};

	const props = withDefaults(defineProps<Props>(), {
		disabled: false,
		allowCustom: false,
		dropdown: 'yes',
		default: 'others.select_value',
	});

	const emit = defineEmits(['update:modelValue', 'select']);

	/// INTERNAL STATE
	const { t } = useI18n();
	const search = ref('');
	const cursor = ref(-1);
	const items = ref<Option[]>([]);
	const dropdown = ref<boolean>(false);
	const inputRef = ref<HTMLInputElement | null>(null);

	onMounted(() => {
		const option = findOptionByValue(props.modelValue);
		search.value = option ? getLabel(option) : (props.modelValue ?? '');
	});

	/// Update when Parent sets value
	watch(
		() => props.modelValue,
		(newVal) => {
			const option = findOptionByValue(newVal);
			search.value = option ? getLabel(option) : (newVal ?? '');
		},
	);
	watch(
		() => props.dropdown,
		(newVal) => {
			if (newVal !== props.default) dropdown.value = false;
		},
	);

	/// Update Parent when user types (only if allowCustom is true)
	watch(search, (val) => {
		if (props.allowCustom) {
			// If custom values allowed, always update
			const matchingOption = props.options.find((opt) => getLabel(opt).toLowerCase() === val.toLowerCase());
			if (matchingOption) {
				emit('update:modelValue', getValue(matchingOption));
			} else {
				emit('update:modelValue', val);
			}
		} else {
			// If custom values not allowed, only update if it matches an option
			const matchingOption = props.options.find((opt) => getLabel(opt).toLowerCase() === val.toLowerCase());
			if (matchingOption) {
				emit('update:modelValue', getValue(matchingOption));
			}
			// Don't emit update for invalid values
		}
	});

	// Helper to get value from option
	function getValue(option: Option): string {
		return typeof option === 'string' ? option : option.value;
	}

	// Helper to get label from option
	function getLabel(option: Option): string {
		return typeof option === 'string' ? option : option.label;
	}

	// Find option by value
	function findOptionByValue(value: string): Option | undefined {
		return props.options.find((opt) => getValue(opt) === value);
	}

	// Check if a value exists in options
	function isValidOption(value: string): boolean {
		return props.options.some((opt) => {
			const optValue = getValue(opt);
			const optLabel = getLabel(opt);
			return optValue.toLowerCase() === value.toLowerCase() || optLabel.toLowerCase() === value.toLowerCase();
		});
	}

	// Display value for the closed dropdown
	const displayValue = computed(() => {
		const option = findOptionByValue(props.modelValue);
		return option ? getLabel(option) : props.modelValue;
	});

	// Open dropdown and focus input
	function openDropdown() {
		emit('update:modelValue', '');
		emit('select', '');
		dropdown.value = true;
		nextTick(() => {
			inputRef.value?.focus();
		});
	}

	// Close dropdown
	function closeDropdown() {
		dropdown.value = false;
		cursor.value = -1;
		items.value = [];

		// Restore previous valid value if custom values not allowed and current search is invalid
		if (!props.allowCustom && search.value.trim()) {
			const isValid = isValidOption(search.value.trim());
			if (!isValid) {
				// Revert to the last valid value
				const option = findOptionByValue(props.modelValue);
				search.value = option ? getLabel(option) : '';
				return;
			}
		}

		// Update to match the current search value
		const option = findOptionByValue(props.modelValue);
		search.value = option ? getLabel(option) : (props.modelValue ?? '');
	}

	/// Filtered Results
	const results = computed(() => {
		const term = search.value.trim().toLowerCase();
		let matches = 0;

		// Check if exact match exists (by value or label)
		const exactMatch = props.options.find((opt) => {
			const label = getLabel(opt).toLowerCase();
			const value = getValue(opt).toLowerCase();
			return label === term || value === term;
		});

		if (exactMatch) return [];

		return props.options.filter((opt) => {
			const label = getLabel(opt).toLowerCase();
			if (label.replace(/[^a-zA-Z ]/g, '').includes(term) && label !== term && matches < 10) {
				matches++;
				return true;
			}
			return false;
		});
	});

	/// Keyboard Navigation
	function cursorDown() {
		if (results.value.length === 0) return;
		cursor.value = (cursor.value + 1) % results.value.length;
	}

	function cursorUp() {
		if (results.value.length === 0) return;
		cursor.value = cursor.value <= 0 ? results.value.length - 1 : cursor.value - 1;
	}

	function onEscape() {
		closeDropdown();
	}

	function onEnter() {
		if (cursor.value >= 0 && cursor.value < results.value.length) {
			// User has navigated to a specific result with arrow keys
			selectItem(results.value[cursor.value]);
		} else if (results.value.length > 0 && !props.allowCustom && search.value.length > 0) {
			// No cursor position, but there are results and custom values not allowed
			// Select the first matching result
			selectItem(results.value[0]);
		} else {
			// Enter while typing
			const matchingOption = props.options.find((opt) => getLabel(opt).toLowerCase() === search.value.toLowerCase());

			if (matchingOption) {
				// Found an exact matching option, select it
				selectItem(matchingOption);
			} else if (props.allowCustom && search.value.trim()) {
				// Custom values allowed and user typed something
				emit('update:modelValue', search.value.trim());
				emit('select', search.value.trim());
				closeDropdown();
			} else {
				// Custom values not allowed and no exact match, don't accept the input
				closeDropdown();
			}
		}
	}

	/// Select Item
	function selectItem(item: Option) {
		search.value = getLabel(item);
		emit('update:modelValue', getValue(item));
		emit('select', getValue(item));
		closeDropdown();
	}
</script>
