<template>
	<div class="p-4">
		<h1>New Design</h1>

		<div class="flex gap-4">
			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2>Button</h2>
				<Button @click="clicked()">Primary</Button>
				<Button icon-left="check-circle" :variant="colorVariant.Secundary" @click="clicked()">Secundary</Button>
				<Button icon-right="smiley" :variant="colorVariant.Tertiary" @click="clicked()">Tertiary</Button>
				<Button icon-left="warning" icon-right="warning" :variant="colorVariant.Error" @click="clicked()">Error</Button>
				<Button icon-left="circle" icon-right="circle" :variant="colorVariant.Disabled" @click="clicked()">Disabled</Button>

				<p>&nbsp;</p>

				<h2>ButtonGroup</h2>
				<ButtonGroup>
					<Button :variant="colorVariant.Secundary">Cancel</Button>
					<Button>Submit</Button>
				</ButtonGroup>
			</div>

			<div class="rounded-lg border-2 border-dotted border-purple-500 p-4">
				<h2>Radio</h2>
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
	import { colorVariant } from '@hub-client/new-design/types/component-variants';

	const clicked = () => {
		alert('clicked!');
	};
</script>
