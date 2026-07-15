<template>
	<details class="group">
		<summary
			class="after:border-on-surface-dim after:right-050 after:mt-050 after:p-050 relative my-100 flex list-none items-start pr-300 after:absolute after:ml-100 after:rotate-45 after:border-r-100 after:border-b-2 group-open:after:mt-100 group-open:after:-rotate-135"
		>
			<div class="bg-accent-primary text-on-accent-primary mr-100 flex h-300 w-300 shrink-0 items-center justify-center rounded-full">
				<Icon
					size="xs"
					type="info"
				/>
			</div>
			{{ props.question }}
		</summary>
		<p class="mb-100 whitespace-pre-line">
			<slot>
				Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec vitae tincidunt nunc, rutrum dapibus ipsum. Nunc feugiat auctor nunc, in tempor
				dui porttitor ac. In hac habitasse platea dictumst. Sed pellentesque ipsum est, vitae dictum lectus bibendum commodo. Sed eget erat quam. Fusce
				pellentesque tristique pharetra. Nam mattis scelerisque tortor, eu malesuada dolor elementum a. Vivamus fringilla augue purus, in efficitur eros
				fringilla ultrices. Ut pretium dui id mi cursus, sit amet vestibulum tellus maximus. Phasellus sodales pharetra arcu, nec mollis felis dictum
				ut. Duis sagittis pulvinar tempor. Morbi ut pretium enim, dictum porttitor lectus. Pellentesque vel augue id lorem pretium ullamcorper.
				Suspendisse ultricies, ante id rutrum ornare, augue sapien tristique ex, at tincidunt magna magna quis justo. Aliquam gravida lacinia urna eget
				egestas.
			</slot>
		</p>
	</details>
</template>

<script lang="ts" setup>
	const props = defineProps({
		question: { type: String, default: '' },
	});
</script>

<style scoped>
	details summary::-webkit-details-marker {
		display: none;
	}
</style>
