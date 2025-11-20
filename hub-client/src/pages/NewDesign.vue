<template>
	<div class="p-4">
		<h1>New Design</h1>

		<div class="flex gap-4">
			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2>Button</h2>
				<Button @click="clicked()">Primary</Button>
				<Button icon-left="check-circle" :variant="buttonColorVariant.Secundary" @click="clicked()">Secundary</Button>
				<Button icon-right="smiley" :variant="buttonColorVariant.Tertiary" @click="clicked()">Tertiary</Button>
				<Button icon-left="warning" icon-right="warning" :variant="buttonColorVariant.Error" @click="clicked()">Error</Button>
				<Button icon-left="circle" icon-right="circle" :variant="buttonColorVariant.Disabled" @click="clicked()">Disabled</Button>

				<p>&nbsp;</p>

				<h2>ButtonGroup</h2>
				<ButtonGroup>
					<Button :variant="buttonColorVariant.Secundary">Cancel</Button>
					<Button>Submit</Button>
				</ButtonGroup>

				<h2>IconButton</h2>
				<IconButton type="check-circle" :variant="iconColorVariant.Primary" @click="clicked()" title="Handig deze title"></IconButton>
				<IconButton type="check-circle" :variant="iconColorVariant.Primary" :size="iconSizeVariant.Small" @click="clicked()" title="Handig deze title"></IconButton>
				<IconButton type="smiley" :variant="iconColorVariant.Secundary" @click="clicked()"></IconButton>
				<IconButton type="smiley" :variant="iconColorVariant.Secundary" :size="iconSizeVariant.Small" @click="clicked()"></IconButton>
				<IconButton type="warning" :variant="iconColorVariant.Secundary" @click="clicked()" :disabled="true"></IconButton>
				<IconButton type="warning" :variant="iconColorVariant.Secundary" :size="iconSizeVariant.Small" @click="clicked()" :disabled="true"></IconButton>
			</div>

			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2>Radio</h2>

				<Radio :options="options" />
			</div>

			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2>Toggle</h2>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import IconButton from '@hub-client/new-design/components/IconButton.vue';
	import Radio from '@hub-client/new-design/components/Radio.vue';
	import { buttonColorVariant, iconColorVariant, iconSizeVariant } from '@hub-client/new-design/types/component-variants';

	const clicked = () => {
		alert('clicked!');
	};

	const options = [
		{ label: 'Option 1', value: 'option1' },
		{ label: 'Option 2', value: 'option2' },
		{ label: 'Option 3', value: 'option3' },
	];
</script>
