<template>
	<div
		class="fixed top-0 right-0 z-50 h-full w-full"
		@keydown.enter="handleEnter"
	>
		<!-- Scrim -->
		<div
			v-if="properties.modal"
			class="bg-scrim/50 dark:bg-scrim/75 absolute h-full w-full"
		/>

		<!-- Dialog -->
		<div
			v-if="!properties.modalonly"
			class="text-on-surface relative top-0 left-0 flex h-full w-full items-center"
			:class="isMobile ? 'justify-end' : 'justify-center'"
			role="dialog"
			@click="doAction(DialogCancel)"
		>
			<div
				class="flex justify-center"
				:class="isMobile && properties.type != 'global' ? 'w-[calc(50vw+40px)]' : 'w-full'"
			>
				<div
					class="bg-surface-base rounded-base border-surface-elevated gap-050 flex max-h-full flex-col justify-between border-3 shadow-2xl"
					:class="width"
					@click.stop
				>
					<div class="flex w-full items-center justify-between p-200">
						<H2 v-if="properties.title !== ''">
							{{ properties.title }}
						</H2>
						<slot name="header" />
						<button
							v-if="properties.close"
							type="button"
							class="float-right cursor-pointer hover:opacity-75"
							:aria-label="$t('dialog.close')"
							@click="doAction(DialogCancel)"
						>
							<Icon type="x" />
						</button>
					</div>
					<Divider
						v-if="hasContent"
						class="my-0!"
					/>
					<div
						v-if="hasContent"
						class="pb-050 h-full p-200 pr-200 text-left"
						:class="props.allowOverflow ? 'overflow-visible' : 'overflow-y-auto'"
					>
						<slot />
						<div
							v-if="properties.content !== ''"
							v-safe-html="properties.content"
						/>
					</div>
					<Divider
						v-if="properties.buttons.length > 0"
						class="my-0!"
					/>
					<div
						v-if="properties.buttons.length > 0"
						class="flex w-full flex-row-reverse justify-start gap-100 p-200"
					>
						<div
							v-for="(button, index) in properties.buttons"
							:key="index"
							class="w-fit"
						>
							<Button
								:variant="button.color"
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
	// Packages
	import { computed, onMounted, onUnmounted, useSlots } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Divider from '@hub-client/components/elements/Divider.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Stores
	import {
		type DialogButton,
		type DialogButtonAction,
		DialogCancel,
		type DialogEntry,
		DialogOk,
		DialogProperties,
		useDialog,
	} from '@hub-client/stores/dialog';
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	const props = withDefaults(
		defineProps<{
			allowOverflow?: boolean;
			buttons?: DialogButton[];
			// Set only by App.vue, for the dialog opened with dialog.show() (confirm(), okcancel(), etc. go through it)
			entry?: DialogEntry | null;
			title?: string;
			type?: 'global' | 'hub';
			width?: string;
		}>(),
		{
			allowOverflow: false,
			buttons: () => [],
			entry: null,
			title: '',
			type: 'hub',
			width: 'w-4/5 md:w-3/5 lg:w-2/5',
		},
	);

	const emit = defineEmits<{ close: [action: DialogButtonAction] }>();

	const dialog = useDialog();
	const slots = useSlots();
	const settings = useSettings();
	// The store opened (and will close) an entry; a component dialog has to say it is open itself.
	// Only one dialog may be open at a time, so never render a Dialog from inside another one.
	const id = props.entry?.id ?? dialog.register();

	const isMobile = computed(() => settings.isMobileState);
	const properties = computed(() => props.entry?.properties ?? new DialogProperties(props.title, '', props.buttons, true, true, props.type));
	const hasContent = computed(() => slots['default'] || properties.value.content !== '');

	onMounted(() => {
		document.addEventListener('keydown', handleGlobalKeydown);
	});

	onUnmounted(() => {
		document.removeEventListener('keydown', handleGlobalKeydown);
		if (!props.entry) dialog.unregister(id);
	});

	function handleGlobalKeydown(e: KeyboardEvent) {
		// Escape dismisses the dialog regardless of where focus currently is
		if (e.key !== 'Escape') return;
		doAction(DialogCancel);
	}

	function handleEnter() {
		if (!properties.value.buttons.some((b) => b.action === DialogOk && b.enabled)) return;
		doAction(DialogOk);
	}

	// Whoever opened the dialog closes it: the parent of a component dialog, or App.vue for a store entry
	function doAction(action: DialogButtonAction) {
		emit('close', action);
	}
</script>
