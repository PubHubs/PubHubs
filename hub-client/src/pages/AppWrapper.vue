<template>
	<App v-if="state === State.Access" />
	<div v-else class="m-auto mt-8 w-6/12 border-2 rounded-md p-2 bg-hub-background-3 text-center">
		<Logo class="mb-8 w-6/12 m-auto"></Logo>
		<div v-if="state === State.NoAccess">
			<p>{{ $t('state.no_access') }}</p>
			<p class="mt-8">
				<button class="mx-1 py-1 px-2 border rounded-md bg-green" @click="onButton()">{{ $t('state.button_request') }}</button>
			</p>
		</div>
		<div v-else-if="state === State.Initial">
			<p>{{ $t('state.initial') }}</p>
		</div>
		<div v-else-if="state === State.RequestingAccess">
			<p>{{ $t('state.requesting') }}</p>
		</div>
		<div v-else-if="state === State.RequestDenied">
			<p>{{ $t('state.denied') }}</p>
		</div>
		<div v-else>
			<p>{{ $t('state.woops') }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	import App from '@/pages/App.vue';
	import { ref, onMounted } from 'vue';

	enum State {
		Initial,
		Access,
		NoAccess,
		RequestingAccess,
		RequestDenied,
	}

	const state = ref(State.Initial);

	onMounted(async () => {
		console.assert(state.value === State.Initial);

		if (await hasStorageAccess()) {
			state.value = State.Access;
		} else {
			state.value = State.NoAccess;
		}
	});

	async function hasStorageAccess(): Promise<boolean> {
		if (!document.hasStorageAccess) {
			// If there's no document.hasStorageAccess,
			// there's likely no third-party tracking cookie blocking
			return true;
		}
		return await document.hasStorageAccess();
	}

	async function requestStorageAccess(): Promise<boolean> {
		try {
			await document.requestStorageAccess();
			return true;
		} catch (error) {
			console.warn(`storage access rejected with error ${error}`);
		}
		return false;
	}

	async function onButton() {
		console.assert(state.value === State.NoAccess);
		state.value = State.RequestingAccess;

		if (await requestStorageAccess()) {
			state.value = State.Access;
		} else {
			state.value = State.RequestDenied;
		}
	}
</script>
