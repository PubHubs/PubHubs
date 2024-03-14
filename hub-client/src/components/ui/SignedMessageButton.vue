<template>
	<button v-if="signedMessagesEnabled" class="flex flex-col items-center m-2" @click="$emit('click', $event)">
		<Icon class="dark:text-white" type="sign"></Icon>
		<p>{{ $t('message.sign.add_signature') }}</p>
	</button>
</template>

<script setup lang="ts">
	import { useSettings } from '@/store/store';

	const settings = useSettings();
	const signedMessagesEnabled = settings.isFeatureEnabled('signedMessages');
</script>
