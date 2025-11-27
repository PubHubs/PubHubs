<template>
	<div class="p-200">
		<h1>New Design</h1>

		<div class="flex gap-200">
			<div class="border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
				<h2 class="mb-200">Button</h2>
				<div class="gap-050 flex flex-col">
					<Button2 icon="check-circle" @click="clicked()" variant="error" title="this is a tooltip"><template v-slot:sr-label>Hi!</template></Button2>
					<Button icon-left="check-circle" @click="clicked()">Primary</Button>
					<Button icon-left="check-circle" :variant="buttonColorVariant.Secundary" @click="clicked()">Secundary</Button>
					<Button icon-right="smiley" :variant="buttonColorVariant.Tertiary" @click="clicked()">Tertiary</Button>
					<Button icon-left="warning" icon-right="warning" :variant="buttonColorVariant.Error" @click="clicked()">Error</Button>
					<Button icon-left="circle" icon-right="circle" :disabled="true" @click="clicked()">Disabled</Button>
				</div>

				<h2 class="my-200">ButtonGroup</h2>
				<ButtonGroup>
					<Button :variant="buttonColorVariant.Secundary">Cancel</Button>
					<Button>Submit</Button>
				</ButtonGroup>

				<h2 class="my-200">IconButton</h2>
				<div class="gap-050 flex flex-col">
					<IconButton type="check-circle" :variant="iconColorVariant.Primary" @click="clicked()" title="Handig deze title"></IconButton>
					<IconButton type="check-circle" :variant="iconColorVariant.Primary" :size="iconSizeVariant.Small" @click="clicked()" title="Handig deze title"></IconButton>
					<IconButton type="smiley" :variant="iconColorVariant.Secundary" @click="clicked()"></IconButton>
					<IconButton type="smiley" :variant="iconColorVariant.Secundary" :size="iconSizeVariant.Small" @click="clicked()"></IconButton>
					<IconButton type="warning" :variant="iconColorVariant.Secundary" @click="clicked()" :disabled="true"></IconButton>
					<IconButton type="warning" :variant="iconColorVariant.Secundary" :size="iconSizeVariant.Small" @click="clicked()" :disabled="true"></IconButton>
				</div>
			</div>

			<div class="border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
				<h2 class="mb-200">Radio</h2>

				<Radio v-model="formValues.radio" value="first">Eerste</Radio>
				<Radio v-model="formValues.radio" value="second">Tweede</Radio>
				<Radio v-model="formValues.radio" value="third">Derde</Radio>

				<h2 class="my-200">Checkbox</h2>
				<Checkbox>Checkbox 0</Checkbox>
				<Checkbox :model-value="true">Checkbox 1</Checkbox>
				<Checkbox :disabled="true">Disabled</Checkbox>
				<Checkbox :disabled="true" :model-value="true">Disabled</Checkbox>

				<h2 class="my-200">Toggle</h2>
				<Toggle>Toggle 0</Toggle>
				<Toggle :model-value="true">Toggle 1</Toggle>
				<Toggle :disabled="true">Disabled</Toggle>
				<Toggle :disabled="true" :model-value="true">Disabled</Toggle>
			</div>

			<div class="border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
				<h2 class="mb-200">Inputs</h2>
				<TextField placeholder="Type voornaam">Voornaam</TextField>
				<TextField placeholder="Type achternaam" :validation="{ required: true }" help="Hier dus je achternaam">Achternaam</TextField>
				<TextField placeholder="Geef getal" :validation="{ isNumber: true, minValue: 2 }" help="Hoe oud ben je?">Leeftijd</TextField>

				<h2 class="my-200">TextArea</h2>
				<TextArea placeholder="Typ opmerking" :validation="{ required: true, minLength: 10 }">Opmerking</TextArea>
				<TextArea placeholder="Type veel" help="Echt lange tekst kan hier">Lange tekst</TextArea>
				<TextArea placeholder="Extra">Nog meer</TextArea>
			</div>
		</div>

		<div class="my-200 border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
			<h2 class="mb-200">Form Test</h2>

			<ValidatedForm v-slot="{ isValidated }">
				<TextField v-model="formValues.firstname" placeholder="Type voornaam">Voornaam</TextField>
				<TextField v-model="formValues.lastname" placeholder="Type achternaam" :validation="{ required: true, minLength: 10 }" help="Hier dus je achternaam">{{ $t('roomlibrary.info.name') }}</TextField>
				<TextField v-model="formValues.age" placeholder="Geef getal" :validation="{ required: true, isNumber: true, minValue: 2, maxValue: 20 }" help="Hoe oud ben je?">Leeftijd</TextField>

				<TextArea placeholder="Type veel" :validation="{ required: true }" help="Echt lange tekst kan hier">Lange tekst</TextArea>

				<div class="mb-200">
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

				<ButtonGroup>
					<Button :disabled="!isValidated" @click.stop.prevent="clicked()">Submit</Button>
				</ButtonGroup>
			</ValidatedForm>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { reactive } from 'vue';

	import Button2 from '@hub-client/new-design/components/Button-v2.vue';
	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import IconButton from '@hub-client/new-design/components/IconButton.vue';
	import Checkbox from '@hub-client/new-design/components/forms/Checkbox.vue';
	import Radio from '@hub-client/new-design/components/forms/Radio.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import Toggle from '@hub-client/new-design/components/forms/Toggle.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';
	import { buttonColorVariant, iconColorVariant, iconSizeVariant } from '@hub-client/new-design/types/component-variants';

	type formType = {
		firstname: string;
		lastname: string;
		age: number;
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
