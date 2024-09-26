<template>
	<ul class="flex gap-4 my-6">
		<li class="text-white w-6 h-6 shrink-0 flex font-bold justify-center rounded-full" :class="dynamicClass(i)" v-for="i in props.totalSteps" :key="i">
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
			c += 'bg-blue';
		} else {
			c += 'bg-gray-light';
		}
		return c;
	}
</script>
