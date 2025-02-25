/** * * Global Dialog, uses dialog.ts store. And is globally present in App.vue * */

<template>
	<div
		@keydown.esc="doAction(DialogCancel)"
		@keydown.enter="
			if (dialog.properties.buttons.some((b) => b.action == 1 && b.enabled)) {
				doAction(DialogOk);
			}
		"
		class="absolute left-0 top-0 h-full w-full"
	>
		<div v-if="dialog.properties.modal" class="absolute inset-0 z-20 h-full bg-gray-middle opacity-75"></div>
		<div v-if="!dialog.properties.modalonly" class="absolute inset-0 z-20 flex h-full py-2" @click="doAction(DialogCancel)">
			<div class="theme-light m-auto flex max-h-full flex-col justify-between gap-1 rounded-lg bg-white p-4 shadow-xl shadow-black" :class="width" @click.stop>
				<div>
					<Icon v-if="dialog.properties.close" type="close" size="md" class="float-right -mt-1 hover:opacity-75" @click="doAction(DialogCancel)"></Icon>
					<H2 v-if="dialog.properties.title !== ''" class="m-0 text-left text-black">{{ dialog.properties.title }}</H2>
					<slot name="header"></slot>
				</div>
				<Line v-if="hasContent" class="z-0"></Line>
				<div v-if="hasContent" class="scrollbar h-full overflow-y-auto py-1 pr-4 text-left">
					<slot></slot>
					<div v-if="dialog.properties.content !== ''">{{ dialog.properties.content }}</div>
				</div>
				<Line class="z-0"></Line>
				<div class="flex flex-row-reverse justify-between gap-2">
					<div v-for="(button, index) in dialog.properties.buttons" :key="index">
						<Button :color="button.color" @click="doAction(button.action)" :disabled="!button.enabled">{{ $t('dialog.' + button.label) }}</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, useSlots, computed, onUnmounted } from 'vue';
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
