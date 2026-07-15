<template>
	<div
		class="bg-surface-base border-surface-elevated flex w-[80ch] min-w-0 shrink-0 snap-center flex-col items-center justify-center rounded border-3 p-500 py-600"
	>
		<div class="relative flex h-full w-full flex-col justify-center overflow-hidden">
			<!-- Two-column layout -->
			<div class="grid h-full grow grid-cols-2 gap-400">
				<!-- Text -->
				<div class="col-span-1 flex flex-col justify-center overflow-y-auto">
					<!-- Header -->
					<div class="mb-300 flex items-center gap-200">
						<div
							class="flex aspect-square h-300 w-300 items-center justify-center rounded-full"
							:class="error ? 'bg-accent-error text-on-accent-error' : 'bg-accent-primary text-on-accent-primary'"
						>
							<Icon
								v-if="error"
								type="warning"
								class="h-200 w-200"
							/>
							<span
								v-else
								class="text-label-small font-semibold"
								>{{ index + 1 }}</span
							>
						</div>
						<slot name="title" />
					</div>
					<div class="mb-400 flex items-center pl-500">
						<slot />
					</div>
				</div>

				<!-- Image -->
				<div class="col-span-1 flex items-center justify-center">
					<slot name="right" />
				</div>
			</div>

			<!-- Footer -->
			<div
				v-if="active"
				class="absolute bottom-0 left-0 mt-300 flex w-full gap-400"
				:class="index == 0 ? 'justify-end' : index == 1 ? 'justify-between' : 'justify-start'"
			>
				<Button
					v-if="index > 0"
					class="w-fit"
					variant="tertiary"
					@click.stop="handlePrev"
				>
					{{ $t('dialog.back') }}
				</Button>
				<Button
					v-if="index < 2"
					class="w-fit"
					@click.stop="handleNext"
				>
					{{ $t('dialog.continue') }}
				</Button>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	const props = defineProps({
		index: {
			type: Number,
			default: undefined,
		},
		active: {
			type: Boolean,
			default: true,
		},
		error: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits(['cardClick', 'next']);

	const handleNext = () => {
		emit('next', (props.index ?? 0) + 1);
	};

	const handlePrev = () => {
		emit('next', (props.index ?? 0) - 1);
	};
</script>
