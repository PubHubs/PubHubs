<template>
	<div class="p-4">
		<h1>New Design</h1>

		<div class="flex gap-4">
			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2 class="mb-4">Button</h2>
				<div class="flex flex-col gap-2">
					<Button icon-left="check-circle" @click="clicked()">Primary</Button>
					<Button icon-left="check-circle" :variant="buttonColorVariant.Secundary" @click="clicked()">Secundary</Button>
					<Button icon-right="smiley" :variant="buttonColorVariant.Tertiary" @click="clicked()">Tertiary</Button>
					<Button icon-left="warning" icon-right="warning" :variant="buttonColorVariant.Error" @click="clicked()">Error</Button>
					<Button icon-left="circle" icon-right="circle" :variant="buttonColorVariant.Disabled" @click="clicked()">Disabled</Button>
				</div>

				<h2 class="my-4">ButtonGroup</h2>
				<ButtonGroup>
					<Button :variant="buttonColorVariant.Secundary">Cancel</Button>
					<Button>Submit</Button>
				</ButtonGroup>

				<h2 class="my-4">IconButton</h2>
				<div class="flex flex-col gap-2">
					<IconButton type="check-circle" :variant="iconColorVariant.Primary" @click="clicked()" title="Handig deze title"></IconButton>
					<IconButton type="check-circle" :variant="iconColorVariant.Primary" :size="iconSizeVariant.Small" @click="clicked()" title="Handig deze title"></IconButton>
					<IconButton type="smiley" :variant="iconColorVariant.Secundary" @click="clicked()"></IconButton>
					<IconButton type="smiley" :variant="iconColorVariant.Secundary" :size="iconSizeVariant.Small" @click="clicked()"></IconButton>
					<IconButton type="warning" :variant="iconColorVariant.Secundary" @click="clicked()" :disabled="true"></IconButton>
					<IconButton type="warning" :variant="iconColorVariant.Secundary" :size="iconSizeVariant.Small" @click="clicked()" :disabled="true"></IconButton>
				</div>
			</div>

			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2 class="mb-4">Radio</h2>

				<Radio v-model="formValues.radio" value="first">Eerste</Radio>
				<Radio v-model="formValues.radio" value="second">Tweede</Radio>
				<Radio v-model="formValues.radio" value="third">Derde</Radio>

				<h2 class="my-4">Checkbox</h2>
				<Checkbox>Checkbox 0</Checkbox>
				<Checkbox>Checkbox 1</Checkbox>

				<h2 class="my-4">Toggle</h2>
				<Toggle>Toggle 0</Toggle>
				<Toggle>Toggle 1</Toggle>
			</div>

			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2 class="mb-4">Inputs</h2>
			</div>
		</div>

		<div class="my-4 rounded-lg border-2 border-dotted border-purple-500 p-4">
			<h2 class="mb-4">Form Test</h2>

			<form>
				<div class="mb-4">
					<Radio v-model="formValues.radio" value="first">Eerste</Radio>
					<Radio v-model="formValues.radio" value="second">Tweede</Radio>
					<Radio v-model="formValues.radio" value="third">Derde</Radio>
				</div>

				<div class="flex gap-12">
					<div>
						<Checkbox v-model="formValues.option1">Option 1</Checkbox>
						<Checkbox v-model="formValues.option2">Option 2</Checkbox>
					</div>
					<div>
						<Toggle v-model="formValues.option1">Option 1</Toggle>
						<Toggle v-model="formValues.option2">Option 2</Toggle>
					</div>
				</div>
			</form>

			<h2 class="my-4">Result values</h2>
			<Json :json="formValues"></Json>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { reactive, ref } from 'vue';

	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import IconButton from '@hub-client/new-design/components/IconButton.vue';
	import Checkbox from '@hub-client/new-design/components/forms/Checkbox.vue';
	import Radio from '@hub-client/new-design/components/forms/Radio.vue';
	import Toggle from '@hub-client/new-design/components/forms/Toggle.vue';
	import { buttonColorVariant, iconColorVariant, iconSizeVariant } from '@hub-client/new-design/types/component-variants';

	type formType = {
		radio: string;
		option1: boolean;
		option2: boolean;
	};

	const formValues = reactive({
		radio: '',
		option1: false,
		option2: true,
	} as formType);

	const clicked = () => {
		alert('clicked!');
	};
</script>
