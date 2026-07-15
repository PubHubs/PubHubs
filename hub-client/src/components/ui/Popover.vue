<template>
	<div
		ref="popover"
		v-click-outside="close"
		class="rounded-base z-100"
		:style="style"
		role="toolbar"
	>
		<IconButton
			v-if="showClosingCross"
			class="absolute top-100 right-100"
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
			// The popover is anchored to the input bar with `bottom` and opens upward. Only flip it to
			// open downward when opening upward would actually push it off the top of the viewport.
			// When flipping we must clear the `bottom` anchor: leaving both `top` and `bottom` set inside
			// the zero-height container collapses the popover's height to 0, which hid it entirely.
			const popoverY = popover.value?.getBoundingClientRect().top ?? 0;
			if (popoverY < 0) {
				style.value += 'top: 0; bottom: auto;';
			}
		});
	});

	async function close() {
		emit('close');
	}
</script>
