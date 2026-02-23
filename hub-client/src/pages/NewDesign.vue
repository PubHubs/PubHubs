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

				<h2 class="my-200">DropDown</h2>
				<DropDown v-model="dropDownValues.simple" :options="options" placeholder="Kies hier iets" :validation="{ required: true }" help="Maak een keuze">Eenvoudig</DropDown>
				<DropDown v-model="dropDownValues.multiple" :options="options" placeholder="Kies hier iets" :multiple="true" :validation="{ required: true }" help="Maak een keuze">Eenvoudig Multiple</DropDown>
				<DropDown v-model="dropDownValues.simpleIcon" :options="iconOptions" placeholder="Kies hier iets" :validation="{ required: true }" help="Maak een keuze">Met Ikonen en Labels</DropDown>
				<DropDown v-model="dropDownValues.multipleIcons" :options="iconOptions" placeholder="Kies hier iets" :multiple="true" :validation="{ required: true }" help="Maak een keuze">Multiple Ikonen en Labels</DropDown>
				<DropDown v-if="userOptions.length > 0" :options="userOptions" placeholder="Selecteer een user" :validation="{ required: true }" help="Users">Userlist</DropDown>
			</div>

			<div class="border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
				<h2 class="mb-200">Inputs</h2>
				<TextField placeholder="Type voornaam">Voornaam</TextField>
				<TextField placeholder="Type achternaam" :validation="{ required: true, maxLength: 10 }" help="Hier dus je achternaam">Achternaam</TextField>
				<TextField placeholder="Geef getal" :validation="{ isNumber: true, minValue: 2 }" help="Hoe oud ben je?">Leeftijd</TextField>

				<h2 class="my-200">TextArea</h2>
				<TextArea placeholder="Typ opmerking" :validation="{ required: true, minLength: 10, maxLength: 100 }" :show-length="true">Opmerking</TextArea>
				<TextArea placeholder="Type veel" help="Echt lange tekst kan hier">Lange tekst</TextArea>
				<TextArea placeholder="Extra" :show-length="true">Nog meer</TextArea>

				<h2 class="my-200">Autocomplete</h2>
				<TextFieldAutoComplete v-model="options[0]" placeholder="start typen" :options="options">Autocomplete simple</TextFieldAutoComplete>
				<TextFieldAutoComplete v-model="iconOptions[1]" placeholder="start typen" :options="iconOptions">Autocomplete iconen</TextFieldAutoComplete>
				<TextFieldAutoComplete v-model="userOptions[0]" placeholder="start typen" :options="userOptions">Autocomplete users</TextFieldAutoComplete>
			</div>

			<div class="border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
				<h2 class="mb-200">Alt components</h2>

				<div class="flex flex-col gap-100">
					<Button
						icon="check-circle"
						title="this is a tooltip"
						variant="primary"
						@click="clicked()"
						v-context-menu="
							(evt: any) =>
								openMenu(evt, [
									{ label: 'Open1', icon: 'smiley', onClick: () => console.error(myProp) },
									{ label: 'Rename1', disabled: true, onClick: () => console.error('Rename1') },
									{ label: 'Delete1', isDelicate: true, onClick: () => clicked() },
								])
						"
					>
						Right click menu test
					</Button>
					<Button icon="check-circle" @click="clicked()" v-context-menu="(evt: any) => openMenu(evt, items2)" variant="primary" title="this is a tooltip">Right click menu test</Button>

					<TextField placeholder="Korte tekst" :validation="{ maxLength: 10 }" help="Hier dus een korte tekst">Korte</TextField>
					<TextArea placeholder="Lange tekst" :validation="{ required: true, minLength: 10 }" help="Lang">Lang</TextArea>
				</div>
			</div>
		</div>

		<div class="my-200 border-spacing-200 rounded-lg border border-dotted border-purple-500 p-200">
			<h2 class="mb-200">Form Test with valdation attributes</h2>

			<ValidatedForm v-slot="{ isValidated }">
				<TextField v-model="formValues.firstname" placeholder="Type voornaam">Voornaam</TextField>
				<TextField v-model="formValues.lastname" placeholder="Type achternaam" :validation="{ required: true, maxLength: 20 }" help="Hier dus je achternaam">{{ $t('roomlibrary.info.name') }}</TextField>
				<TextField v-model="formValues.age" placeholder="Geef getal" :validation="{ required: true, isNumber: true, minValue: 2, maxValue: 20 }" help="Hoe oud ben je?">Leeftijd</TextField>
				<TextField v-model="formValues.specific" placeholder="Type Yes or No" :validation="{ custom: mustBeYesOrNo() }">Yes or No</TextField>
				<TextArea v-model="formValues.text" placeholder="Type veel" :validation="{ required: true }" help="Echt lange tekst kan hier">Lange tekst</TextArea>

				<div class="mb-200">
					<ValidateField v-model="formValues.radio" :validation="{ required: true, custom: customRadioValidation() }">
						<Label>Keuze:</Label>
						<Radio v-model="formValues.radio" value="first">Eerste</Radio>
						<Radio v-model="formValues.radio" value="second">Tweede</Radio>
						<Radio v-model="formValues.radio" value="third">Derde</Radio>
					</ValidateField>
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
	import { onMounted, reactive, ref } from 'vue';

	// Models
	import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
	import { InputType, MultipleInputType } from '@hub-client/models/validation/TFormOption';
	import { FieldOptions } from '@hub-client/models/validation/TFormOption';
	import { ValidationRule } from '@hub-client/models/validation/TValidate';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// New design
	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import IconButton from '@hub-client/new-design/components/IconButton.vue';
	import Checkbox from '@hub-client/new-design/components/forms/Checkbox.vue';
	import DropDown from '@hub-client/new-design/components/forms/DropDown.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import Radio from '@hub-client/new-design/components/forms/Radio.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import TextFieldAutoComplete from '@hub-client/new-design/components/forms/TextFieldAutoComplete.vue';
	import Toggle from '@hub-client/new-design/components/forms/Toggle.vue';
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';
	import type { MenuItem } from '@hub-client/new-design/models/contextMenu.models';

	// Types
	type formType = {
		firstname: string;
		lastname: string;
		age: number | undefined;
		specific: string;
		text: string;
		radio: string;
		option1: boolean;
		option2: boolean;
	};

	const formValues = reactive({
		firstname: '',
		lastname: '',
		age: undefined,
		specific: '',
		text: '',
		radio: '',
		option1: false,
		option2: true,
	} as formType);

	const myProp = 'Hi';

	const items2: MenuItem[] = [
		{ label: 'Open1', icon: 'smiley', payload: { myProp } },
		{ label: 'Rename2', disabled: true },
		{ label: 'Delete2', isDelicate: true },
	];

	const options = ['Optie 1', 'Mogelijkheid 2', 'Derde kans', 'Quattro', 'Meer dan vijf is niet nodig'] as FieldOptions;
	const iconOptions = [
		{ icon: 'basketball', value: 'een', label: 'Optie 1' },
		{ icon: 'dog', value: 'twee', label: 'Mogelijkheid 2' },
		{ icon: 'globe', value: 'drie', label: 'Derde kans' },
		{ icon: 'key', value: 'vier', label: 'Quattro' },
		{ icon: 'shield', value: 'vijf', label: 'Meer dan vijf is niet nodig' },
	] as FieldOptions;
	const userOptions = ref<FieldOptions>([]);
	const dropDownValues = reactive({
		simple: options[0] as InputType,
		multiple: [options[2], options[4]] as MultipleInputType,
		simpleIcon: iconOptions[0] as InputType,
		multipleIcons: [iconOptions[0], iconOptions[4]] as MultipleInputType,
	});

	onMounted(() => {
		document.addEventListener('context-menu-select', (e: any) => {
			const item = e.detail.item;
			if (item.label === 'Open1') {
				console.log('Message:', myProp);
			}
		});
	});

	onMounted(async () => {
		const users = await ManagementUtils.getUsersAccounts();
		const user = useUser();
		userOptions.value = users.map((item) => {
			let avatar = user.userAvatar(item.name);
			if (typeof avatar === 'undefined') avatar = '';
			return {
				value: item.name,
				label: item.displayname,
				avatar: avatar,
			};
		});
	});

	const clicked = () => {
		alert('clicked!');
	};

	// Context menu
	const { openMenu } = useContextMenu();

	// Custom validator Example
	function mustBeYesOrNoFn() {
		return (value: any) => {
			if (!value) {
				return false;
			}
			const low = (value as string).toLocaleLowerCase();
			const result = (low === 'yes' || low === 'no') as boolean;
			return result;
		};
	}

	function mustBeYesOrNo() {
		let rule = {
			validator: mustBeYesOrNoFn(),
			args: [] as any[],
			message: {
				translationKey: 'Must be YES or NO',
				parameters: [],
			},
		} as ValidationRule;
		return rule;
	}

	function customRadioValidation() {
		let rule = {
			validator: (value: any) => {
				if (value == 'second') return true;
				return false;
			},
			args: [] as any[],
			message: {
				translationKey: 'Must be second option',
				parameters: [],
			},
		} as ValidationRule;
		return rule;
	}
</script>
