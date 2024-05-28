<template>
	<TabHeader>
		<TabPill v-for="(item, index) in list" :key="index" class="h-8">
			{{ pillTitle(index) }}
			<Icon v-if="index > 0" type="remove" class="float-right text-red opacity-50 hover:opacity-100 cursor-pointer ml-1" @click.stop="removeItem(index)"></Icon>
		</TabPill>
		<div class="float-right h-8 tabs-tab inline-block rounded-t border border-b-0 px-2 py-1 cursor-pointer z-20 theme-light:border-gray" @click.stop="addItem()">
			<Icon type="plus" class="text-green-dark opacity-70 hover:opacity-100 cursor-pointer" @click.stop="addItem()"></Icon>
		</div>
	</TabHeader>
	<TabContainer>
		<TabContent v-for="(item, index) in list" :key="index">
			<FormLine v-for="(type, ti) in template" :key="ti">
				<Label>{{ type.label }}</Label>
				<TextInput v-if="type.type === 'text'" :placeholder="(index + 1).toString()" :value="item[type.key]" @input="update(index, type.key, $event.target.value)"></TextInput>
				<TextArea class="theme-light:bg-white" v-if="type.type === 'textarea'" :modelValue="item[type.key]" :maxLength="type.maxLength" @input="update(index, type.key, $event.target.value)"></TextArea>
				<Checkbox v-if="type.type === 'checkbox'" :value="item[type.key]" @input="update(index, type.key, $event.target.checked)"></Checkbox>
				<Select v-if="type.type === 'select'" :value="item[type.key]" :options="type.options" @input="update(index, type.key, $event.target.value)"></Select>
				<AutoComplete v-if="type.type === 'autocomplete'" :value="item[type.key]" :options="type.options" @update="update(index, type.key, $event)"></AutoComplete>
			</FormLine>
		</TabContent>
	</TabContainer>
</template>

<script setup lang="ts">
	import { ref, inject } from 'vue';
	import { InputType, FormObjectInputTemplate } from '@/composables/useFormInputEvents';

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
		list.value.push({ ...defaultItem });
		setActiveTab(list.value.length);
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
