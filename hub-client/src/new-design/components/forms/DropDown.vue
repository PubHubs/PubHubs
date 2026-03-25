<template>
	<OnClickOutside @trigger="close()">
		<ValidateField
			:name="fieldName"
			:validation="validation"
			:help="help"
			class="form-dropdown gap-050 relative mb-2 flex w-full flex-col items-start justify-start"
			v-slot="{ id }"
			v-model="model"
			@keydown.arrow-down.prevent="cursorDown()"
			@keydown.arrow-up.prevent="cursorUp()"
			@keydown.enter.prevent="selectCursor(cursor)"
			@keydown.space.prevent="toggle()"
			@keydown.delete="removeLast()"
			@keydown.esc.stop.prevent="
				resetFilter();
				close();
			"
			@keydown="focusFilter($event)"
			:title="textValue"
		>
			<Label :for="id"><slot></slot></Label>

			<div :id="id" class="bg-surface outline-offset-thin outline-on-surface-dim focus:ring-button-blue flex w-full flex-col rounded outline focus:ring-3" role="combobox" tabindex="0" ref="element">
				<span class="name hidden">{{ fieldName }}</span>
				<div :class="showFilter ? 'py-075 h-500 border-b px-175' : 'h-0 overflow-hidden border-0 p-0'">
					<input
						v-model="filter"
						ref="filterInput"
						:placeholder="$t('others.filter_values')"
						class="text-on-surface-dim"
						tabindex="-1"
						@keydown.tab="
							resetFilter();
							completeEl?.focus();
						"
					/>
				</div>
				<div v-if="!showFilter" class="max-h-500 w-full items-center overflow-hidden px-175 py-100">
					<div class="dropdown-value inline-block max-h-300 min-h-6 grow cursor-pointer" @click.stop="toggle">
						<div v-if="model">
							<div v-if="multiple" class="gap-050 flex max-h-300 items-center" ref="values">
								<template v-for="(item, index) in model">
									<div v-if="(index as number) <= model.length - moreItems" class="bg-surface-subtle inline-block rounded px-100" role="listbox">
										<div class="flex items-center">
											<div class="grow">
												<DropDownValue :value="transform(item)"></DropDownValue>
											</div>
											<div class="ml-100">
												<Icon type="x" size="sm" class="" @click.stop="removeItem(index as number)"></Icon>
											</div>
										</div>
									</div>
								</template>
								<div v-if="moreItems > 0" class="bg-surface-subtle inline-block rounded px-100">+ {{ moreItems - 1 }}</div>
							</div>
							<DropDownValue v-else :value="transform(model)"></DropDownValue>
						</div>
						<span v-else class="text-surface-subtle">{{ placeholder }}</span>
					</div>
					<div class="mt-025 absolute top-300 right-0 flex h-400 items-center pr-175">
						<div v-if="model" class="dropdown-remove-all pr-075 ml-100 cursor-pointer bg-transparent" @click.stop="resetAll()">
							<Icon type="x" size="md" class="h-200 w-200"></Icon>
						</div>
						<div class="dropdown-toggler cursor-pointer border-l bg-transparent" @click.stop="toggle">
							<Icon type="caret-down" size="md" weight="fill" class="ml-050 -mr-050"></Icon>
						</div>
					</div>
				</div>
			</div>

			<div v-show="open && filteredOptions.length > 0" class="absolute top-800 z-50 flex w-full grow flex-col pb-300">
				<div class="bg-surface-low outline-offset-thin rounded outline">
					<DropDownOption
						v-for="(option, index) in filteredOptions"
						:value="option.item"
						:highlighted="cursor === index"
						:active="selection.includes(option.index)"
						@click.stop="select(option.index)"
						class="-ml-[1px]"
					></DropDownOption>
				</div>
			</div>
		</ValidateField>
	</OnClickOutside>
</template>

<script setup lang="ts">
	// Packages
	import { OnClickOutside } from '@vueuse/components';
	import { computed, nextTick, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue';

	// Composables
	import { useKeyStrokes } from '@hub-client/composables/useKeyStrokes';

	// Models
	import { FieldSelection } from '@hub-client/models/validation/TFormOption';
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

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
			options: any;
			placeholder?: string;
			validation?: FieldValidations;
			filtered?: boolean;
			transformer?: Function; // Give a transformer function to transform given data/options to FieldOption(s) for DropDown
		}>(),
		{
			disabled: false,
			help: '',
			multiple: false,
			placeholder: '',
			validation: undefined,
			filtered: false,
		},
	);

	const model = defineModel<any>();

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
		setItems(filteredOptions.value as Array<any>);
		// Set selection
		if (model.value) {
			if (props.multiple) {
				for (let i = 0; i < model.value.length; i++) {
					const idx = (props.options as Array<any>).findIndex((item) => {
						return item == toRaw(model.value[i]);
					});
					if (idx >= 0) {
						selection.value.push(idx);
					}
				}
			} else {
				const idx = (props.options as Array<any>).findIndex((item) => item == toRaw(model.value));
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

	const transform = (item: any) => {
		if (typeof props.transformer === 'function') {
			return (props.transformer as Function)(item);
		}
		return item;
	};

	const transformedOptions = computed(() => {
		if (typeof props.transformer === 'function') {
			return props.options.map((item: any) => (props.transformer as Function)(item));
		}
		return props.options;
	});

	const filteredOptions = computed(() => {
		let idx = 0;
		let filtered = transformedOptions.value.map((item: any) => {
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
				filtered = filtered.filter((item: any) => {
					let label = item.item;
					if (item.item.label) {
						label = item.item.label;
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
				open.value = true;
			}
		}
		setItems(filtered as Array<any>);
		cursor.value = -1;
		return filtered;
	});

	const textValue = computed(() => {
		if (!model.value) return '';
		if (props.multiple) {
			const texts = model.value.map((element: any) => {
				const value = transform(element);
				return value.label || value;
			});
			return texts.join(' | ');
		} else {
			const value = transform(model.value);
			return value.label || value;
		}
	});

	const showFilter = computed(() => {
		return props.filtered && filter.value !== '';
	});

	const resetFilter = () => {
		filter.value = '';
	};

	const focusFilter = (key) => {
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
		model.value.splice(index, 1);
		selection.value.splice(index, 1);
		controlMaxWidth();
	};

	const removeLast = () => {
		removeItem(selection.value.length - 1);
	};

	const select = (index: number, force: boolean = false) => {
		if (props.multiple) {
			if (selection.value.includes(index)) {
				const idx = selection.value.findIndex((item: any) => item == index);
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
			let newModel = [] as Array<any> | undefined;
			for (let i = 0; i < selection.value.length; i++) {
				newModel?.push((props.options as Array<any>)[selection.value[i]]);
			}
			if (newModel?.length == 0) {
				newModel = undefined;
			}
			model.value = newModel;
		} else {
			if (selection.value.length > 0) {
				model.value = (props.options as Array<any>)[selection.value[0]];
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
		const maxElWidth = completeEl.value?.offsetWidth! - 110;
		let valWidth = valuesEl.value?.offsetWidth!;
		while (valWidth > maxElWidth) {
			moreItems.value++;
			await nextTick();
			valWidth = valuesEl.value?.offsetWidth!;
		}
	};
</script>
