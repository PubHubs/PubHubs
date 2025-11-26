<template>
	<div class="bg-surface-high z-40 rounded-md" v-click-outside="close" role="toolbar">
		<IconButton v-if="showClosingCross" type="x" size="base" @click="close()" class="absolute top-2 right-2" />
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	const emit = defineEmits(['close']);

	window.addEventListener(
		'keydown',
		(e) => {
			if (e.key === 'Escape') {
				close();
			}
		},
		{ once: true },
	);

	type Props = {
		showClosingCross?: boolean;
	};

	withDefaults(defineProps<Props>(), {
		showClosingCross: false,
	});

	async function close() {
		emit('close');
	}
</script>
