<template>
	<div
		class="flex flex-col gap-2"
		:title="title"
	>
		<div
			class="flex items-center justify-between"
			:class="collapsible ? 'cursor-pointer' : ''"
			@click="collapsible && toggle()"
		>
			<div class="text-on-surface-dim flex items-center gap-2">
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
						class="text-body-small truncate leading-tight font-semibold first-letter:uppercase"
						role="heading"
					>
						{{ label }}
					</p>
				</slot>
			</div>
			<div class="flex items-center gap-2">
				<slot name="right" />
			</div>
		</div>
		<div
			v-show="!collapsible || !collapsed"
			class="mt-2"
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
