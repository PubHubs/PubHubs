<template>
	<div
		v-click-outside="close"
		class="z-40 rounded-md"
		role="toolbar"
	>
		<IconButton
			v-if="showClosingCross"
			class="absolute top-2 right-2"
			size="base"
			type="x"
			@click="close()"
		/>
		<slot />
	</div>
</template>

<script lang="ts" setup>
	withDefaults(defineProps<Props>(), {
		showClosingCross: false,
	});

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

	async function close() {
		emit('close');
	}
</script>
