<template>
	<OnClickOutside @trigger="close()">
		<ValidateField
			v-slot="{ id: fieldId }"
			v-model="model"
			class="form-dropdown gap-050 relative mb-2 flex w-full flex-col items-start justify-start"
			:help="help"
			:name="fieldName"
			:title="textValue"
			:validation="validation"
			@keydown="focusFilter($event)"
			@keydown.arrow-down.prevent="cursorDown()"
			@keydown.arrow-up.prevent="cursorUp()"
			@keydown.delete="removeLast()"
			@keydown.enter.prevent="selectCursor(cursor)"
			@keydown.esc.stop.prevent="
				resetFilter();
				close();
			"
			@keydown.space.prevent="toggle()"
		>
			<Label :for="fieldId"><slot /></Label>

			<div
				:id="fieldId"
				ref="element"
				class="bg-surface outline-offset-thin outline-on-surface-dim focus:ring-button-blue flex w-full flex-col rounded outline focus:ring-3"
				role="combobox"
				tabindex="0"
			>
				<span class="name hidden">{{ fieldName }}</span>
				<div :class="showFilter ? 'py-075 h-500 border-b px-175' : 'h-0 overflow-hidden border-0 p-0'">
					<input
						ref="filterInput"
						v-model="filter"
						class="text-on-surface-dim"
						:placeholder="$t('others.filter_values')"
						tabindex="-1"
						@keydown.tab="
							resetFilter();
							completeEl?.focus();
						"
					/>
				</div>
				<div
					v-if="!showFilter"
					class="max-h-500 w-full items-center overflow-hidden px-175 py-100"
				>
					<div
						class="dropdown-value inline-block max-h-300 min-h-6 grow cursor-pointer"
						@click.stop="toggle"
					>
						<div v-if="model">
							<div
								v-if="multiple"
								ref="values"
								class="gap-050 flex max-h-300 items-center"
							>
								<template
									v-for="(item, index) in modelAsArray"
									:key="index"
								>
									<div
										v-if="(index as number) <= modelAsArray.length - moreItems"
										class="bg-surface-subtle inline-block rounded px-100"
										role="listbox"
									>
										<div class="flex items-center">
											<div class="grow">
												<DropDownValue :value="transform(item)" />
											</div>
											<div class="ml-100">
												<Icon
													class=""
													size="sm"
													type="x"
													@click.stop="removeItem(index as number)"
												/>
											</div>
										</div>
									</div>
								</template>
								<div
									v-if="moreItems > 0"
									class="bg-surface-subtle inline-block rounded px-100"
								>
									+ {{ moreItems - 1 }}
								</div>
							</div>
							<DropDownValue
								v-else
								:value="transform(model)"
							/>
						</div>
						<span
							v-else
							class="text-surface-subtle"
							>{{ placeholder }}</span
						>
					</div>
					<div class="mt-025 absolute top-300 right-0 flex h-400 items-center pr-175">
						<div
							v-if="model"
							class="dropdown-remove-all pr-075 ml-100 cursor-pointer bg-transparent"
							@click.stop="resetAll()"
						>
							<Icon
								class="h-200 w-200"
								size="md"
								type="x"
							/>
						</div>
						<div
							class="dropdown-toggler cursor-pointer border-l bg-transparent"
							@click.stop="toggle"
						>
							<Icon
								class="ml-050 -mr-050"
								size="md"
								type="caret-down"
								weight="fill"
							/>
						</div>
					</div>
				</div>
			</div>

			<div
				v-show="open && filteredOptions.length > 0"
				class="absolute top-800 z-50 flex w-full grow flex-col pb-300"
			>
				<div class="bg-surface-low outline-offset-thin rounded outline">
					<DropDownOption
						v-for="(option, index) in filteredOptions"
						:key="index"
						:active="selection.includes(option.index)"
						class="-ml-[1px]"
						:highlighted="cursor === index"
						:value="option.item"
						@click.stop="select(option.index)"
					/>
				</div>
			</div>
		</ValidateField>
	</OnClickOutside>
</template>

<script lang="ts" setup>
	// Packages
	import { OnClickOutside } from '@vueuse/components';
	import { computed, nextTick, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue';

	// Composables
	import { useKeyStrokes } from '@hub-client/composables/useKeyStrokes';

	// Models
	import { type FieldOption, type FieldOptions, type FieldSelection } from '@hub-client/models/validation/TFormOption';
	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

	// New design
	import DropDownOption from '@hub-client/new-design/components/forms/DropDownOption.vue';
	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
			help?: string;
			id?: string;
			multiple?: boolean;
			name?: string;
			options: FieldOptions | unknown[];
			placeholder?: string;
			validation?: FieldValidations;
			filtered?: boolean;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- accepts various typed transform functions
			transformer?: Function; // Give a transformer function to transform given data/options to FieldOption(s) for DropDown
		}>(),
		{
			disabled: false,
			help: '',
			id: undefined,
			multiple: false,
			name: undefined,
			placeholder: '',
			validation: undefined,
			filtered: false,
			transformer: undefined,
		},
	);

	const model = defineModel<unknown>();

	const { setItems, cursor, cursorDown, cursorUp } = useKeyStrokes();
	const { fieldName, update } = useFormInput(props, model);

	const open = ref(false);
	const selection = ref<FieldSelection>([]); // Selection of chosen indexes
	const filter = ref('');
	const filterEl = useTemplateRef('filterInput');

	const completeEl = useTemplateRef('element');
	const valuesEl = useTemplateRef('values');
	const moreItems = ref(0);

	onMounted(() => {
		setItems(filteredOptions.value as Array<unknown>);
		// Set selection
		if (model.value) {
			if (props.multiple) {
				const modelArr = model.value as unknown[];
				for (let i = 0; i < modelArr.length; i++) {
					const idx = props.options.findIndex((item) => {
						return item === toRaw(modelArr[i]);
					});
					if (idx >= 0) {
						selection.value.push(idx);
					}
				}
			} else {
				const idx = props.options.findIndex((item) => item === toRaw(model.value));
				if (idx >= 0) {
					selection.value.push(idx);
				}
			}
		}
		// Set cursor off until it is used
		cursor.value = -1;
	});

	onMounted(async () => {
		await controlMaxWidth();
	});

	// Make sure dropdown is opened when cursorkey is used
	watch(cursor, () => {
		if (cursor.value >= 0) {
			open.value = true;
		}
	});

	const transform = (item: unknown): string | FieldOption => {
		if (typeof props.transformer === 'function') {
			return props.transformer(item) as string | FieldOption;
		}
		return item as string | FieldOption;
	};

	const modelAsArray = computed(() => model.value as unknown[]);

	const transformedOptions = computed((): (string | FieldOption)[] => {
		if (typeof props.transformer === 'function') {
			return props.options.map((item) => props.transformer?.(item) as string | FieldOption);
		}
		return props.options as (string | FieldOption)[];
	});

	const filteredOptions = computed(() => {
		let idx = 0;
		let filtered = transformedOptions.value.map((item) => {
			const indexed = {
				index: idx,
				item: item,
			};
			idx++;
			return indexed;
		});
		if (props.filtered) {
			if (filter.value.length > 0) {
				let matches = 0;
				const searchValue = (filter.value?.toString() || '').toLowerCase();
				filtered = filtered.filter((item) => {
					let label = item.item as string | { label?: string };
					if (typeof label === 'object' && label !== null && label.label) {
						label = label.label;
					}
					// Make sure that only searched in alphabetical characters, so 'email' will find 'e-mail'.
					label = label
						.toString()
						.replace(/[^a-zA-Z ]/g, '')
						.toLowerCase();
					if (label.includes(searchValue) && matches < 10 && label.toLowerCase() !== searchValue) {
						matches++;
						return item;
					}
				});
			}
		}
		return filtered;
	});

	watch(
		filteredOptions,
		(filtered) => {
			setItems(filtered as Array<unknown>);
			cursor.value = -1;
			if (props.filtered && filter.value.length > 0 && filtered.length > 0) {
				open.value = true;
			}
		},
		{ immediate: true },
	);

	const textValue = computed(() => {
		if (!model.value) return '';
		if (props.multiple) {
			const modelArr = model.value as unknown[];
			const texts = modelArr.map((element) => {
				const value = transform(element) as string | { label?: string };
				return (typeof value === 'object' && value !== null && value.label) || value;
			});
			return texts.join(' | ');
		} else {
			const value = transform(model.value) as string | { label?: string };
			return (typeof value === 'object' && value !== null && value.label) || value;
		}
	});

	const showFilter = computed(() => {
		return props.filtered && filter.value !== '';
	});

	const resetFilter = () => {
		filter.value = '';
	};

	const focusFilter = (key: KeyboardEvent) => {
		if (props.filtered) {
			if (!['Escape', 'ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(key.key)) {
				filterEl.value?.focus();
			}
		}
	};

	const selectCursor = (cursor: number) => {
		if (filteredOptions.value.length > 0) {
			let index = -1;
			// If just pressed enter and not used cursor yet, select first one
			if (cursor === -1) {
				index = filteredOptions.value[0].index;
			} else {
				if (filteredOptions.value[cursor]) {
					index = filteredOptions.value[cursor].index;
				}
			}
			if (index >= 0) {
				select(index, true);
			}
		}
	};

	const removeItem = (index: number) => {
		(model.value as unknown[]).splice(index, 1);
		selection.value.splice(index, 1);
		controlMaxWidth();
	};

	const removeLast = () => {
		removeItem(selection.value.length - 1);
	};

	const select = (index: number, force: boolean = false) => {
		if (props.multiple) {
			if (selection.value.includes(index)) {
				const idx = selection.value.findIndex((item) => item === index);
				if (idx >= 0) {
					selection.value.splice(idx, 1);
				}
			} else {
				selection.value.push(index);
			}
		} else {
			if (selection.value.includes(index) && !force) {
				selection.value = [];
			} else {
				selection.value = [index];
			}
		}

		// Sort selection
		selection.value = selection.value.sort();

		// Update model
		if (props.multiple) {
			let newModel = [] as Array<unknown> | undefined;
			for (let i = 0; i < selection.value.length; i++) {
				newModel?.push(props.options[selection.value[i]]);
			}
			if (newModel?.length === 0) {
				newModel = undefined;
			}
			model.value = newModel;
		} else {
			if (selection.value.length > 0) {
				model.value = props.options[selection.value[0]];
			} else {
				model.value = undefined;
			}
		}

		resetFilter();
		update();
		close();
		controlMaxWidth();
	};

	const resetAll = () => {
		model.value = undefined;
		selection.value = [];
		resetFilter();
		update();
		close();
		controlMaxWidth();
	};

	const toggle = () => {
		open.value = !open.value;
	};

	const close = () => {
		open.value = false;
	};

	const controlMaxWidth = async () => {
		moreItems.value = 0;
		await nextTick();
		const maxElWidth = (completeEl.value?.offsetWidth ?? 0) - 110;
		let valWidth = valuesEl.value?.offsetWidth ?? 0;
		while (valWidth > maxElWidth) {
			moreItems.value++;
			await nextTick();
			valWidth = valuesEl.value?.offsetWidth ?? 0;
		}
	};
</script>
