<template>
	<span v-for="(member, index) in members" :key="index">
		<span v-if="index > 0"> &bull; </span>
		{{ member }}
	</span>
</template>

<script setup lang="ts">
	defineProps({
		members: {
			type: Array,
			required: true,
		},
	});
</script>
