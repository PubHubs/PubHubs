<template>
	<div
		ref="popover"
		v-click-outside="close"
		class="rounded-base z-40"
		:style="style"
		role="toolbar"
	>
		<IconButton
			v-if="showClosingCross"
			class="absolute top-2 right-2"
			size="base"
			icon="x"
			@click="close()"
		/>
		<slot />
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { nextTick, onMounted, ref } from 'vue';

	// Components
	import IconButton from '@hub-client/components/elements/IconButton.vue';

	withDefaults(defineProps<Props>(), {
		showClosingCross: false,
	});
	const emit = defineEmits(['close']);
	const popover = ref<HTMLElement | null>(null);
	const style = ref('');

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

	onMounted(() => {
		nextTick(() => {
			const split = Math.floor(window.innerHeight / 2);
			const popoverY = popover.value?.getBoundingClientRect().top ?? 0;
			const popoverSize = popover.value?.clientHeight ?? 0;
			let adjust = 0;
			if (popoverY < split) {
				adjust = popoverSize;
				style.value += 'top:' + adjust + 'px;';
			}
		});
	});

	async function close() {
		emit('close');
	}
</script>
