<!-- Global Dialog, uses dialog.ts store. And is globally present in App.vue -->

<template>
	<div
		class="fixed left-0 top-0 z-50 h-full w-full"
		@keydown.esc="doAction(DialogCancel)"
		@keydown.enter="
			if (dialog.properties.buttons.some((b) => b.action == 1 && b.enabled)) {
				doAction(DialogOk);
			}
		"
	>
		<!-- Scrim -->
		<div v-if="dialog.properties.modal" class="absolute h-full w-full bg-surface-high opacity-80" />

		<!-- Dialog -->
		<div v-if="!dialog.properties.modalonly" class="relative left-0 top-0 flex h-full w-full items-center justify-center text-on-surface" @click="doAction(DialogCancel)">
			<div class="m-2 flex max-h-full flex-col justify-between gap-1 rounded-md bg-surface-low p-4 shadow-xl shadow-surface-high md:m-4" :class="width" @click.stop>
				<div class="flex w-full items-center justify-between">
					<H2 v-if="dialog.properties.title !== ''">{{ dialog.properties.title }}</H2>
					<slot name="header"></slot>
					<Icon v-if="dialog.properties.close" type="close" size="md" class="float-right -mt-1 cursor-pointer self-end hover:opacity-75" @click="doAction(DialogCancel)" />
				</div>
				<Line v-if="hasContent" class="z-0" />
				<div v-if="hasContent" class="h-full overflow-y-auto py-1 pr-4 text-left">
					<slot></slot>
					<div v-if="dialog.properties.content !== ''">
						{{ dialog.properties.content }}
					</div>
				</div>
				<Line class="z-0" />
				<div class="flex w-full flex-row-reverse justify-start gap-2">
					<div v-for="(button, index) in dialog.properties.buttons" :key="index" class="w-fit">
						<Button :color="button.color" @click="doAction(button.action)" :disabled="!button.enabled">{{ $t('dialog.' + button.label) }}</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Package imports
	import { onMounted, useSlots, computed, onUnmounted } from 'vue';

	// Hub imports
	import { DialogButton, DialogButtonAction, DialogOk, DialogCancel, useDialog } from '@/logic/store/dialog';

	const emit = defineEmits(['close']);
	const dialog = useDialog();
	const slots = useSlots();

	const hasContent = computed(() => {
		return slots['default'] || dialog.properties.content !== '';
	});

	const props = defineProps({
		title: {
			type: String,
			default: '',
		},
		width: {
			type: String,
			default: 'w-4/5 md:w-3/5 lg:w-2/5',
		},
		buttons: {
			type: Array<DialogButton>,
			default: [],
		},
	});

	onUnmounted(() => {
		dialog.hideModal();
	});

	onMounted(() => {
		if (props.title !== '') {
			dialog.properties.title = props.title;
		}
		if (props.buttons.length > 0) {
			dialog.properties.buttons = props.buttons;
		}
		dialog.showModal();
	});

	function doAction(action: DialogButtonAction) {
		emit('close', action);
		dialog.hideModal();
		dialog.close(action);
	}
</script>

<style scoped>
	.adjust-left {
		transform: translateX(-2.5rem);
	}
	/* sm - width of bar = 640 - 128 =  512 */
	@media (min-width: 512px) {
		.adjust-left {
			transform: translateX(-4rem);
		}
	}
</style>
