<template>
	<ul class="mb-300 flex gap-200">
		<li
			v-for="i in props.totalSteps"
			:key="i"
			class="text-on-surface flex h-300 w-300 shrink-0 items-center justify-center rounded-full font-bold"
			:class="dynamicClass(i)"
		>
			{{ i < props.currentStep ? '&#10003;' : `${i}` }}
		</li>
	</ul>
</template>

<script lang="ts" setup>
	const props = defineProps({
		currentStep: {
			type: Number,
			required: true,
		},
		totalSteps: {
			type: Number,
			default: 3,
		},
	});

	function dynamicClass(i: number): string {
		let c = '';
		if (i <= props.currentStep) {
			c += 'bg-accent-primary text-on-accent-primary!';
		} else {
			c += 'bg-on-surface-disabled';
		}
		return c;
	}
</script>
