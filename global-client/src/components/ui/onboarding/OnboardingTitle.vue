<template>
	<div class="mb-4 flex items-center">
		<H1 class="mr-3 text-xl xl:mr-4 xl:text-4xl">{{ $t('register.register_with') }}</H1>
		<figure class="h-[1.125rem] lg:h-6">
			<Logo />
		</figure>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Logo from '@global-client/components/ui/Logo.vue';
</script>
