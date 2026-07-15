<template>
	<div class="mb-200 flex items-center">
		<H1 class="mr-150 text-xl xl:mr-200 xl:text-4xl">
			{{ $t('register.register_with') }}
		</H1>
		<figure class="h-[1.125rem] lg:h-300">
			<Logo />
		</figure>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Logo from '@global-client/components/ui/Logo.vue';

	import H1 from '@hub-client/components/elements/H1.vue';
</script>
