<template>
	<details class="group">
		<summary
			class="after:border-on-surface-dim group-open:after:-rotate-135 relative my-2 flex list-none items-start pr-6 after:absolute after:right-1 after:ml-2 after:mt-1 after:rotate-45 after:border-b-2 after:border-r-2 after:p-1 group-open:after:mt-2"
		>
			<div class="bg-accent-primary text-on-accent-primary mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
				<Icon type="info" size="xs" />
			</div>
			{{ props.question }}
		</summary>
		<p class="mb-2 whitespace-pre-line">
			<slot>
				Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec vitae tincidunt nunc, rutrum dapibus ipsum. Nunc feugiat auctor nunc, in tempor dui porttitor ac. In hac habitasse platea dictumst. Sed pellentesque ipsum est,
				vitae dictum lectus bibendum commodo. Sed eget erat quam. Fusce pellentesque tristique pharetra. Nam mattis scelerisque tortor, eu malesuada dolor elementum a. Vivamus fringilla augue purus, in efficitur eros fringilla
				ultrices. Ut pretium dui id mi cursus, sit amet vestibulum tellus maximus. Phasellus sodales pharetra arcu, nec mollis felis dictum ut. Duis sagittis pulvinar tempor. Morbi ut pretium enim, dictum porttitor lectus.
				Pellentesque vel augue id lorem pretium ullamcorper. Suspendisse ultricies, ante id rutrum ornare, augue sapien tristique ex, at tincidunt magna magna quis justo. Aliquam gravida lacinia urna eget egestas.
			</slot>
		</p>
	</details>
</template>

<script setup lang="ts">
	const props = defineProps({
		question: { type: String },
	});
</script>

<style scoped>
	details summary::-webkit-details-marker {
		display: none;
	}
</style>
