<template>
	<div class="z-40 rounded-md bg-surface-high" v-click-outside="close">
		<Icon v-if="showClosingCross" type="closingCross" size="base" :asButton="true" @click="close()" class="absolute right-2 top-2" />
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
