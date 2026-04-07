<template>
	<div
		class="fixed top-0 right-0 z-50 h-full w-full"
		@keydown.enter="
			if (dialog.properties.buttons.some((b) => b.action == 1 && b.enabled)) {
				doAction(DialogOk);
			}
		"
		@keydown.esc="doAction(DialogCancel)"
	>
		<!-- Scrim -->
		<div
			v-if="dialog.properties.modal"
			class="bg-surface-high absolute h-full w-full opacity-80"
		/>

		<!-- Dialog -->
		<div
			v-if="!dialog.properties.modalonly"
			class="text-on-surface relative top-0 left-0 flex h-full w-full items-center"
			:class="isMobile ? 'justify-end' : 'justify-center'"
			role="dialog"
			@click="doAction(DialogCancel)"
		>
			<div
				class="flex justify-center"
				:class="isMobile && dialog.properties.type != 'global' ? 'w-[calc(50vw+40px)]' : 'w-full'"
			>
				<div
					class="bg-surface-low shadow-surface-high flex max-h-full flex-col justify-between gap-1 rounded-md p-4 shadow-xl md:m-4"
					:class="width"
					@click.stop
				>
					<div class="flex w-full items-center justify-between">
						<H2 v-if="dialog.properties.title !== ''">
							{{ dialog.properties.title }}
						</H2>
						<slot name="header" />
						<Icon
							v-if="dialog.properties.close"
							class="float-right -mt-1 cursor-pointer hover:opacity-75"
							size="md"
							type="x"
							@click="doAction(DialogCancel)"
						/>
					</div>
					<Line
						v-if="hasContent"
						class="z-0"
					/>
					<div
						v-if="hasContent"
						class="h-full py-1 pr-4 text-left"
						:class="props.allowOverflow ? 'overflow-visible' : 'overflow-y-auto'"
					>
						<slot />
						<!-- eslint-disable vue/no-v-html -- sanitized via sanitizeHtml -->
						<div
							v-if="dialog.properties.content !== ''"
							v-html="sanitizedContent"
						/>
						<!-- eslint-enable vue/no-v-html -->
					</div>
					<div
						v-if="dialog.properties.buttons.length > 0"
						class="flex w-full flex-row-reverse justify-start gap-2"
					>
						<Line class="z-0" />
						<div
							v-for="(button, index) in dialog.properties.buttons"
							:key="index"
							class="w-fit"
						>
							<Button
								:color="button.color"
								:disabled="!button.enabled"
								@click="doAction(button.action)"
							>
								{{ $t('dialog.' + button.label) }}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Package imports
	import { type PropType, computed, onMounted, onUnmounted, useSlots, watch } from 'vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Line from '@hub-client/components/elements/Line.vue';

	// Logic
	import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';

	// Hub imports
	import { type DialogButton, type DialogButtonAction, DialogCancel, DialogOk, useDialog } from '@hub-client/stores/dialog';
	import { useSettings } from '@hub-client/stores/settings';

	const props = defineProps({
		title: {
			type: String,
			default: '',
		},
		type: {
			type: String as PropType<'global' | 'hub'>,
			default: 'hub',
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
	const emit = defineEmits(['close']);
	const dialog = useDialog();
	const slots = useSlots();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const hasContent = computed(() => {
		return slots['default'] || dialog.properties.content !== '';
	});

	const sanitizedContent = computed(() => sanitizeHtml(dialog.properties.content));

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
		dialog.properties.type = props.type;
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
