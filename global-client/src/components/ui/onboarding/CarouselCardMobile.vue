<template>
	<div
		class="bg-surface-base rounded-base border-surface-elevated mt-100 flex aspect-2/3 h-fit w-full min-w-0 shrink-0 snap-center flex-col items-center justify-center overflow-hidden border-3 p-400"
	>
		<div class="relative flex h-full w-full flex-col gap-200 overflow-hidden">
			<!-- Header -->
			<div class="items-top flex h-full flex-row gap-200">
				<div
					class="mt-100 flex aspect-square h-200 w-200 items-center justify-center rounded-full"
					:class="error ? 'bg-accent-error text-on-accent-error' : 'bg-accent-primary text-on-accent-primary'"
				>
					<Icon
						v-if="error"
						type="warning"
						class="h-150 w-150"
					/>
					<span
						v-else
						class="text-label-small font-semibold"
						>{{ index + 1 }}</span
					>
				</div>
				<div class="flex h-full w-full flex-col gap-200">
					<slot name="title" />
					<div class="flex h-full flex-col gap-400 overflow-y-auto">
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
						class="-ml-400 flex items-center justify-center pt-200"
					>
						<slot name="extra" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

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
