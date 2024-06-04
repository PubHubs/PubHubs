<template>
	<div v-if="hasJoined && welcomeBox" class="absolute h-screen w-full top-0 left-0 flex items-center justify-center">
		<div class="absolute inset-0 h-screen z-10 bg-gray-middle opacity-95 flex items-center justify-center">
			<div class="theme-light max-h-full max-w-2xl p-4 rounded-lg shadow-xl shadow-black bg-white flex flex-col justify-center items-center gap-4" @click.stop>
				<div class="flex flex-col items-center text-center w-full">
					<H2 class="mb-4">Welcome to your new community Hub!</H2>
					<p class="text-gray mb-2">This Hub has given you a random name (pseudonym)</p>
					<p class="text-black text-xl mb-0">{{ user.user.userId.split(':')[0].substring(1) }}</p>
					<p class="text-gray mb-2">You can choose a nickname yourself that others in the Hub will see:</p>
					<TextInput class="w-1/2 p-2 border rounded focus:outline-none focus:border-blue text-center mb-2" v-model.trim="user.user.rawDisplayName" @changed="updateData($event)"></TextInput>
					<p class="text-gray text-sm mb-2">You can also choose a nickname later, or change it again.</p>
					<p class="text-gray mb-4">For certain rooms in this Hub, you may be asked to reveal (part of) your identity, via the Yivi app. This gives participants in those rooms certainty about each other.</p>
					<Button color="green" class="w-1/3" @click="submitAndClose">Continue</Button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';
	import { useUser } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { MatrixClient } from 'matrix-js-sdk';
	const user = useUser();
	let displayName = user.user.rawDisplayName;
	let welcomeBox = ref(true);
	let hasJoined = ref(true);
	const pubhubs = usePubHubs();

	onMounted(async () => {
		await user.fetchDisplayName(pubhubs.client as MatrixClient);
		const joinResponse = await pubhubs.hasUserJoinedHub();
		//console.info('Join Response', joinResponse);
		if (!joinResponse.joined) {
			hasJoined.value = true;
		} else {
			hasJoined.value = false;
		}
	});

	function updateData(name: string) {
		displayName = name;
	}

	async function submit() {
		await pubhubs.changeDisplayName(displayName);
	}

	function submitAndClose() {
		submit();
		welcomeBox.value = false;
		hasJoined.value = false;
	}
</script>
