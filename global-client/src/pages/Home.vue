<template>
	<div class="w-1/2 md:w-2/6 m-4 text-center mx-auto">
		<Logo class="m-8"></Logo>
		<p class="text-center" v-html="$t('home.welcome')"></p>
		<Button v-if="!global.loggedIn" class="mt-8" @click="global.login()">{{ $t('login.global_login') }}</Button>
	</div>

	<div class="w-4/6 mx-auto my-8">
		<Line class="mb-8 mx-1"></Line>

		<H2 class="text-center mb-8">{{ $t('home.highlighted_hubs') }}</H2>

		<div class="grid md:grid-cols-3 grid-cols-1 gap-4">
			<router-link v-for="hub in hubs.sortedHubsArray" :key="hub.hubId" :to="{ name: 'hub', params: { id: hub.hubId } }">
				<HubBlock :hub="hub"></HubBlock>
			</router-link>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useGlobal, useHubs } from '@/store/store';
	const global = useGlobal();
	const hubs = useHubs();
</script>
