<template>
	<div class="flex aspect-[2/3] h-full w-full min-w-0 shrink-0 snap-center flex-col items-center justify-center overflow-hidden rounded-3xl bg-surface-low p-8">
		<div class="relative flex h-full w-full flex-col gap-4 overflow-hidden">
			<!-- Header -->
			<div class="items-top flex h-full flex-row gap-4">
				<span class="mt-2 flex aspect-square h-4 w-4 items-center justify-center rounded-full bg-accent-primary text-on-accent-primary">
					<span class="font-semibold text-label-small">{{ index + 1 }}</span>
				</span>
				<div class="flex h-full w-full flex-col gap-4">
					<slot name="title"></slot>
					<div class="flex h-full flex-col gap-8 overflow-y-auto">
						<slot />

						<!-- Image -->
						<div v-if="$slots.image" class="flex items-center justify-center">
							<slot name="image" />
						</div>
					</div>
					<!-- Extra -->
					<div v-if="$slots.extra" class="-ml-8 flex items-center justify-center pt-4">
						<slot name="extra" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	const props = defineProps({
		index: Number,
	});
</script>
