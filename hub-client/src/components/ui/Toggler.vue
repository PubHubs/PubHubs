<template>
	<div>
		<div class="flex justify-items-stretch">
			<div class="flex-grow">
				<slot name="title"></slot>
			</div>
			<div>
				<Icon :type="icon" :class="iconClass" class="cursor-pointer" @click="toggle()" />
			</div>
		</div>
		<div>
			<slot name="content" :state="toggleState"></slot>
		</div>
	</div>
</template>

<script lang="ts">
	import { icons } from '@/assets/icons';
</script>

<script setup lang="ts">
	import { ref, computed } from 'vue';

	const props = defineProps({
		icon: {
			type: String,
			default: 'edit',
			validator(value: string) {
				return Object.keys(icons).includes(value);
			},
		},
		color: {
			type: String,
			default: 'text-black dark:text-white',
		},
		activeColor: {
			type: String,
			default: 'text-red',
		},
	});

	const iconClass = computed(() => {
		if (toggleState.value) {
			return props.activeColor;
		}
		return props.color;
	});

	const toggleState = ref(false);

	function toggle() {
		if (toggleState.value) {
			toggleState.value = false;
		} else {
			toggleState.value = true;
		}
	}
</script>
