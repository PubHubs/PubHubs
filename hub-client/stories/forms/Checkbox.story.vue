<template>
	<Story title="Forms/Checkbox">
		<Checkbox v-model="checked" class="mr-2"></Checkbox>
		<Checkbox v-model="checked" class="mr-2"></Checkbox>
		{{ checked }}
	</Story>
</template>
<script setup lang="ts">
	import { ref } from 'vue';
	import Checkbox from '@/components/forms/Checkbox.vue';

	const checked = ref(true);
</script>
