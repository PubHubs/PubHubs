<template>
	<TabHeader>
		<TabPill v-for="(item, index) in list" :key="index" class="h-8">
			{{ pillTitle(index) }}
			<Icon v-if="props.canRemove && index > 0" type="remove" class="float-right ml-1 cursor-pointer text-red opacity-50 hover:opacity-100" @click.stop="removeItem(index)"></Icon>
		</TabPill>
		<div v-if="props.canAdd" class="tabs-tab z-20 float-right inline-block h-8 cursor-pointer rounded-t border border-b-0 px-2 py-1 theme-light:border-gray" @click.stop="addItem()">
			<Icon type="plus" class="cursor-pointer text-green-dark opacity-70 hover:opacity-100" @click.stop="addItem()"></Icon>
		</div>
	</TabHeader>
	<TabContainer>
		<TabContent v-for="(item, index) in list" :key="index">
			<FormLine v-for="(type, ti) in template" :key="ti">
				<Label>{{ type.label }}</Label>
				<TextInput v-if="type.type === 'text'" :placeholder="(index + 1).toString()" :value="item[type.key]" :disabled="type.disabled" @input="update(index, type.key, $event.target.value)"></TextInput>
				<TextArea class="theme-light:bg-white" v-if="type.type === 'textarea'" :modelValue="item[type.key]" :disabled="type.disabled" :maxLength="type.maxLength" @input="update(index, type.key, $event.target.value)"></TextArea>
				<Checkbox v-if="type.type === 'checkbox'" :value="item[type.key]" :disabled="type.disabled" @input="update(index, type.key, $event.target.checked)"></Checkbox>
				<Select v-if="type.type === 'select'" :value="item[type.key]" :options="type.options" :disabled="type.disabled" @input="update(index, type.key, $event.target.value)"></Select>
				<AutoComplete v-if="type.type === 'autocomplete'" :value="item[type.key]" :options="type.options" :disabled="type.disabled" @input="update(index, type.key, $event.target.value)" @changed="update(index, type.key, $event)">
				</AutoComplete>
			</FormLine>
		</TabContent>
	</TabContainer>
</template>

<script setup lang="ts">
	// Components
	import TabHeader from '../ui/TabHeader.vue';
	import TabPill from '../ui/TabPill.vue';
	import Icon from '../elements/Icon.vue';
	import TabContainer from '../ui/TabContainer.vue';
	import TabContent from '../ui/TabContent.vue';
	import FormLine from './FormLine.vue';
	import Label from './Label.vue';
	import TextInput from './TextInput.vue';
	import TextArea from './TextArea.vue';
	import Checkbox from './Checkbox.vue';
	import Select from './Select.vue';
	import AutoComplete from './AutoComplete.vue';

	import { ref, inject } from 'vue';
	import { InputType, FormObjectInputTemplate } from '@/logic/composables/useFormInputEvents';

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
