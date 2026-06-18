<template>
	<div
		class="flex flex-col gap-100"
		:title="title"
	>
		<div class="flex items-center justify-between gap-200">
			<div
				class="text-on-surface-dim flex w-full items-center gap-100"
				:class="collapsible ? 'cursor-pointer' : ''"
				@click="collapsible && toggle()"
			>
				<Icon
					v-if="collapsible"
					class="transition-transform duration-200"
					:class="{ 'rotate-45': !collapsed }"
					size="sm"
					type="caret-right"
					weight="fill"
				/>
				<slot name="header">
					<p
						v-if="label"
						class="text-body-small lineline-clamp-1 w-full truncate leading-tight font-semibold first-letter:uppercase"
						role="heading"
					>
						{{ label }}
					</p>
				</slot>
			</div>
			<div class="flex items-center gap-100">
				<slot name="right" />
			</div>
		</div>
		<div
			v-show="!collapsible || !collapsed"
			class="mt-100"
		>
			<slot />
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	withDefaults(defineProps<{ label: string; title?: string | undefined; collapsible?: boolean }>(), {
		collapsible: true,
		title: undefined,
	});

	const collapsed = ref(false);

	function toggle() {
		collapsed.value = !collapsed.value;
	}
</script>
