<template>
	<ul class="mb-6 flex gap-4">
		<li class="text-on-surface flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold" :class="dynamicClass(i)" v-for="i in props.totalSteps" :key="i">
			{{ i < props.currentStep ? '&#10003;' : `${i}` }}
		</li>
	</ul>
</template>

<script setup lang="ts">
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
			c += 'bg-accent-primary !text-on-accent-primary';
		} else {
			c += 'bg-on-surface-disabled';
		}
		return c;
	}
</script>
