<template>
	<TabHeader>
		<TabPill v-for="(item, index) in list" :key="index" class="h-8">
			{{ pillTitle(index) }}
			<Icon v-if="props.canRemove && index > 0" type="trash" class="text-red float-right ml-1 cursor-pointer opacity-50 hover:opacity-100" @click.stop="removeItem(index)" />
		</TabPill>
		<div v-if="props.canAdd" class="tabs-tab z-20 float-right inline-block h-8 cursor-pointer rounded-t border border-b-0 px-2 py-1" @click.stop="addItem()">
			<Icon type="plus" class="cursor-pointer opacity-70 hover:opacity-100" @click.stop="addItem()" />
		</div>
	</TabHeader>
	<TabContainer>
		<TabContent v-for="(item, index) in list" :key="index">
			<FormLine v-for="(type, ti) in template" :key="ti">
				<Label class="~text-label-min/label-max">{{ type.label }}</Label>
				<TextInput
					v-if="type.type === 'text'"
					:placeholder="(index + 1).toString()"
					:value="item[type.key]"
					:disabled="type.disabled"
					@input="update(index, type.key, $event.target.value)"
					class="bg-background ~text-label-min/label-max"
				/>
				<TextArea
					class="bg-background ~text-label-min/label-max"
					v-if="type.type === 'textarea'"
					:modelValue="item[type.key]"
					:disabled="type.disabled"
					:maxLength="type.maxLength"
					@input="update(index, type.key, $event.target.value)"
				/>
				<Checkbox v-if="type.type === 'checkbox'" :value="item[type.key]" :disabled="type.disabled" @input="update(index, type.key, $event.target.checked)" class="~text-label-min/label-max" />
				<Select v-if="type.type === 'select'" :value="item[type.key]" :options="type.options" :disabled="type.disabled" @input="update(index, type.key, $event.target.value)" class="~text-label-min/label-max" />
				<AutoComplete
					v-if="type.type === 'autocomplete'"
					:value="item[type.key]"
					:options="type.options"
					:disabled="type.disabled"
					@input="update(index, type.key, $event.target.value)"
					@changed="update(index, type.key, $event)"
					class="~text-label-min/label-max"
				>
				</AutoComplete>
			</FormLine>
		</TabContent>
	</TabContainer>
</template>

<script setup lang="ts">
	// Packages
	import { inject, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AutoComplete from '@hub-client/components/forms/AutoComplete.vue';
	import Checkbox from '@hub-client/components/forms/Checkbox.vue';
	import FormLine from '@hub-client/components/forms/FormLine.vue';
	import Label from '@hub-client/components/forms/Label.vue';
	import Select from '@hub-client/components/forms/Select.vue';
	import TextArea from '@hub-client/components/forms/TextArea.vue';
	import TextInput from '@hub-client/components/forms/TextInput.vue';
	import TabContainer from '@hub-client/components/ui/TabContainer.vue';
	import TabContent from '@hub-client/components/ui/TabContent.vue';
	import TabHeader from '@hub-client/components/ui/TabHeader.vue';
	import TabPill from '@hub-client/components/ui/TabPill.vue';

	// Composables
	import { FormObjectInputTemplate, InputType } from '@hub-client/composables/useFormInputEvents';

	const setActiveTab = inject('setActiveTab') as Function;
	const removeTab = inject('removeTab') as Function;
	const emit = defineEmits(['input']);

	const props = defineProps({
		template: {
			type: Array<FormObjectInputTemplate>,
			required: true,
		},
		modelValue: {
			type: Array<any>,
			required: true,
		},
		canAdd: {
			type: Boolean,
			required: false,
			default: true,
		},
		canRemove: {
			type: Boolean,
			required: false,
			default: true,
		},
	});

	let defaultItem = {} as any;
	props.template.forEach((item) => {
		defaultItem[item.key] = item.default;
	});

	const list = ref(props.modelValue);
	if (list.value.length === 0) {
		list.value.push({ ...defaultItem });
	}

	function addItem() {
		if (props.canAdd) {
			list.value.push({ ...defaultItem });
			setActiveTab(list.value.length);
		}
	}

	function removeItem(index: number) {
		list.value.splice(index, 1);
		removeTab();
	}

	function update(index: number, key: string, value: InputType) {
		list.value[index][key] = value;
		emit('input', list.value);
	}

	function pillTitle(index: number) {
		return `#${index + 1}`;
	}
</script>
