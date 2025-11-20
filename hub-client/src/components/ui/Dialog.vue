<template>
	<div
		class="fixed top-0 left-0 z-50 h-full w-full"
		@keydown.esc="doAction(DialogCancel)"
		@keydown.enter="
			if (dialog.properties.buttons.some((b) => b.action == 1 && b.enabled)) {
				doAction(DialogOk);
			}
		"
	>
		<!-- Scrim -->
		<div v-if="dialog.properties.modal" class="bg-surface-high absolute h-full w-full opacity-80" />

		<!-- Dialog -->
		<div role="dialog" v-if="!dialog.properties.modalonly" class="text-on-surface relative top-0 left-0 flex h-full w-full items-center justify-center" @click="doAction(DialogCancel)">
			<div class="bg-surface-low shadow-surface-high m-2 flex max-h-full flex-col justify-between gap-1 rounded-md p-4 shadow-xl md:m-4" :class="width" @click.stop>
				<div class="flex w-full items-center justify-between">
					<H2 v-if="dialog.properties.title !== ''">{{ dialog.properties.title }}</H2>
					<slot name="header"></slot>
					<Icon v-if="dialog.properties.close" type="x" size="md" class="float-right -mt-1 cursor-pointer self-end hover:opacity-75" @click="doAction(DialogCancel)" />
				</div>
				<Line v-if="hasContent" class="z-0" />
				<div v-if="hasContent" class="h-full py-1 pr-4 text-left" :class="props.allowOverflow ? 'overflow-visible' : 'overflow-y-auto'">
					<slot></slot>
					<div v-if="dialog.properties.content !== ''" v-html="dialog.properties.content"></div>
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
	// Packages
	import { computed, onMounted, onUnmounted, useSlots, watch } from 'vue';

	// Coponents
	import Button from '@hub-client/components/elements/Button.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Line from '@hub-client/components/elements/Line.vue';

	// Stores
	import { DialogButton, DialogButtonAction, DialogCancel, DialogOk, useDialog } from '@hub-client/stores/dialog';

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
		allowOverflow: {
			type: Boolean,
			default: false,
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

	watch(
		() => props.buttons,
		(newButtons) => {
			dialog.properties.buttons = newButtons;
		},
		{ deep: true },
	);

	function doAction(action: DialogButtonAction) {
		emit('close', action);
		dialog.hideModal();
		dialog.close(action);
	}
</script>
