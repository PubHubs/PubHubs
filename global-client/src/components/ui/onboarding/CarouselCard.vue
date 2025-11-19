<template>
	<div class="flex w-[80ch] min-w-0 shrink-0 snap-center flex-col items-center justify-center rounded-3xl bg-surface-low p-10 py-12">
		<div class="relative flex h-full w-full flex-col justify-center overflow-hidden">
			<!-- Two-column layout -->
			<div class="grid h-full grow grid-cols-2 gap-8">
				<!-- Text -->
				<div class="col-span-1 flex flex-col justify-center overflow-y-auto">
					<!-- Header -->
					<div class="mb-6 flex items-center gap-4">
						<div class="flex aspect-square h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-on-accent-primary">
							<span class="font-semibold text-label-small">{{ index + 1 }}</span>
						</div>
						<slot name="title"></slot>
					</div>
					<div class="mb-8 flex items-center pl-10">
						<slot />
					</div>
				</div>

				<!-- Image -->
				<div class="col-span-1 flex items-center justify-center">
					<slot name="right" />
				</div>
			</div>

			<!-- Footer -->
			<div class="absolute bottom-0 left-0 mt-6 flex w-full gap-8" :class="index == 0 ? 'justify-end' : index == 1 ? 'justify-between' : 'justify-start'">
				<Button v-if="index > 0" @click.stop="handlePrev" class="w-fit" color="text">{{ $t('dialog.back') }}</Button>
				<Button v-if="index < 2" @click.stop="handleNext" class="w-fit">{{ $t('dialog.continue') }}</Button>
			</div>
		</div>
	</div>
</template>

<script setup>
	// Components
	import Button from '@hub-client/components/elements/Button.vue';

	const props = defineProps({
		index: Number,
	});

	const emit = defineEmits(['cardClick', 'next']);

	const handleNext = () => {
		emit('next', props.index + 1);
	};

	const handlePrev = () => {
		emit('next', props.index - 1);
	};
</script>
