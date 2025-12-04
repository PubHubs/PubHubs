<template>
	<div class="cursor-pointer" @click="toggle()">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	import { inject } from 'vue';

	const toggle = inject('toggle') as Function;
</script>
