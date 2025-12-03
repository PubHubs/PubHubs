<template>
	<div class="p-200">
		<h1>New Design</h1>

		<div class="flex gap-200">
			<div class="border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
				<h2 class="mb-200">Buttons</h2>
				<div class="gap-050 flex flex-col">
					<Button icon="check-circle" @click="clicked()" variant="primary" title="this is a tooltip">Primary<template v-slot:sr-label>Hi!</template></Button>
					<Button icon="check-circle" @click="clicked()">Primary</Button>
					<Button icon="check-circle" variant="secondary" @click="clicked()">Secondary</Button>
					<Button secondary-icon="smiley" variant="tertiary" @click="clicked()">Tertiary</Button>
					<Button icon="warning" secondary-icon="warning" variant="error" @click="clicked()">Error</Button>
					<Button icon="circle" secondary-icon="circle" :disabled="true" @click="clicked()">Disabled</Button>
					<Button icon="circle" secondary-icon="circle" :loading="true" @click="clicked()">Loading</Button>
					<Button icon="warning" secondary-icon="smiley" @click="clicked()">Extreem lange tekst in deze button die moet worden afgekapt maar wel in de title</Button>
					<div class="flex items-center gap-100">
						<Button icon="pencil-simple" @click="clicked()" title="Handig deze title"></Button>
						<Button icon="folder-simple" variant="secondary" @click="clicked()" title="Handig deze title"></Button>
						<Button icon="folder-simple" variant="tertiary" @click="clicked()" title="Handig deze title"></Button>
						<Button icon="warning" variant="error" @click="clicked()" title="Handig deze title"></Button>
						<Button icon="warning" variant="error" @click="clicked()" :loading="true" :disabled="true" title="Handig deze title"></Button>
					</div>
				</div>

				<h2 class="my-200">ButtonGroup</h2>
				<ButtonGroup>
					<Button type="reset" variant="secondary">Cancel</Button>
					<Button type="submit">Submit</Button>
				</ButtonGroup>

				<h2 class="my-200">IconButton</h2>
				<div class="gap-050 flex flex-col">
					<IconButton icon="check-circle" @click="clicked()" aria-label="Label voor screenreaders" title="Handig deze title"></IconButton>
					<IconButton icon="check-circle" size="sm" @click="clicked()" aria-label="Label voor screenreaders" title="Handig deze title"></IconButton>
					<IconButton icon="smiley" variant="secondary" @click="clicked()" aria-label="Label voor screenreaders" title="Handig deze title"></IconButton>
					<IconButton icon="smiley" size="sm" variant="secondary" @click="clicked()" aria-label="Label voor screenreaders" title="Handig deze title"></IconButton>
					<IconButton icon="warning" variant="secondary" :disabled="true" @click="clicked()" aria-label="Label voor screenreaders" title="Handig deze title"></IconButton>
					<IconButton icon="warning" size="sm" variant="secondary" :disabled="true" @click="clicked()" aria-label="Label voor screenreaders" title="Handig deze title"></IconButton>
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

			<div class="border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
				<h2 class="mb-200">Alt components</h2>

				<div class="flex flex-col gap-100">
					<Button
						icon="check-circle"
						@click="clicked()"
						@contextmenu="
							openMenu($event, [
								{ label: 'Open1', icon: 'smiley', onClick: () => console.error(myProp) },
								{ label: 'Rename1', disabled: true, onClick: () => console.error('Rename1') },
								{ label: 'Delete1', isDelicate: true, onClick: () => console.error('Delete1') },
							])
						"
						variant="primary"
						title="this is a tooltip"
						>Right click menu test</Button
					>
					<Button icon="check-circle" @click="clicked()" @contextmenu="openMenu($event, items2)" variant="primary" title="this is a tooltip">Right click menu test</Button>

					<TextField2 placeholder="Geef getal" :validation="{ isNumber: true, minValue: 2 }" help="Hoe oud ben je?">Leeftijd</TextField2>
					<TextArea2 placeholder="Geef getal" :validation="{ isNumber: true, minValue: 2 }" help="Hoe oud ben je?">Leeftijd</TextArea2>
				</div>
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
					<Button type="submit" :disabled="!isValidated" @click.stop.prevent="clicked()">Submit</Button>
				</ButtonGroup>
			</ValidatedForm>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, reactive } from 'vue';

	// New design
	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import IconButton from '@hub-client/new-design/components/IconButton.vue';
	import Checkbox from '@hub-client/new-design/components/forms/Checkbox.vue';
	import Radio from '@hub-client/new-design/components/forms/Radio.vue';
	import TextArea2 from '@hub-client/new-design/components/forms/TextArea-v2.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import TextField2 from '@hub-client/new-design/components/forms/TextField-v2.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import Toggle from '@hub-client/new-design/components/forms/Toggle.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';
	import { MenuItem } from '@hub-client/new-design/stores/contextMenu.store';

	// Types
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

	// Context menu
	const { openMenu } = useContextMenu();

	const myProp = 'Hi';

	const items2: MenuItem[] = [
		{ label: 'Open1', icon: 'smiley', payload: { myProp } },
		{ label: 'Rename2', disabled: true },
		{ label: 'Delete2', isDelicate: true },
	];

	onMounted(() => {
		document.addEventListener('context-menu-select', (e: any) => {
			const item = e.detail.item;
			if (item.label === 'Open1') {
				console.log('Message:', myProp);
			}
		});
	});
</script>
