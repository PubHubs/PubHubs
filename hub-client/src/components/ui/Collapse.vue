<template>
	<div class="relative">
		<div class="bg-blue hover:bg-blue-dark relative z-10 flex cursor-pointer justify-items-stretch rounded-md p-2 text-white" @click="toggle()">
			<div>
				<Icon :type="collapsed ? 'chevron-right' : 'chevron-down'"></Icon>
			</div>
			<div class="flex-grow">
				<slot name="header"></slot>
			</div>
		</div>
		<div v-show="!collapsed" class="-z-10 -mt-2 rounded-md border p-2">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	import Icon from '@/components/elements/Icon.vue';
	import { ref } from 'vue';

	const collapsed = ref(true);

	function toggle() {
		collapsed.value = !collapsed.value;
	}
</script>
