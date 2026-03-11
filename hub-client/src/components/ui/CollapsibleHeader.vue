<template>
	<div class="flex flex-col gap-2" :title="title">
		<div class="flex cursor-pointer items-center justify-between" @click="toggle()">
			<div class="flex items-center gap-2">
				<Icon type="caret-right" weight="fill" size="sm" class="transition-transform duration-200" :class="{ 'rotate-45': !collapsed }" />
				<slot name="header">
					<p v-if="label" class="truncate leading-tight font-bold first-letter:uppercase" role="heading">{{ label }}</p>
				</slot>
			</div>
			<div class="flex items-center gap-2">
				<slot name="right"></slot>
			</div>
		</div>
		<div v-show="!collapsed" class="mt-2">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps<{ label?: string; title?: string }>();

	const collapsed = ref(false);

	function toggle() {
		collapsed.value = !collapsed.value;
	}
</script>
