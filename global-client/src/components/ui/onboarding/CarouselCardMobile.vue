<template>
	<div
		class="bg-surface-low mt-2 flex aspect-2/3 h-fit w-full min-w-0 shrink-0 snap-center flex-col items-center justify-center overflow-hidden rounded-3xl p-8"
	>
		<div class="relative flex h-full w-full flex-col gap-4 overflow-hidden">
			<!-- Header -->
			<div class="items-top flex h-full flex-row gap-4">
				<div
					class="mt-2 flex aspect-square h-4 w-4 items-center justify-center rounded-full"
					:class="error ? 'bg-accent-error text-on-accent-error' : 'bg-accent-primary text-on-accent-primary'"
				>
					<Icon
						v-if="error"
						type="warning"
						class="h-3 w-3"
					/>
					<span
						v-else
						class="text-label-small font-semibold"
						>{{ index + 1 }}</span
					>
				</div>
				<div class="flex h-full w-full flex-col gap-4">
					<slot name="title" />
					<div class="flex h-full flex-col gap-8 overflow-y-auto">
						<slot />

						<!-- Image -->
						<div
							v-if="$slots.image"
							class="flex items-center justify-center"
						>
							<slot name="image" />
						</div>
					</div>
					<!-- Extra -->
					<div
						v-if="$slots.extra"
						class="-ml-8 flex items-center justify-center pt-4"
					>
						<slot name="extra" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	defineProps({
		index: {
			type: Number,
			default: undefined,
		},
		error: {
			type: Boolean,
			default: false,
		},
	});
</script>
