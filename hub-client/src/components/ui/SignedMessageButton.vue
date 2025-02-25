<template>
	<button v-if="signedMessagesEnabled" class="m-2 flex flex-col items-center" @click="$emit('click', $event)">
		<Icon class="dark:text-white" type="sign"></Icon>
		<p>{{ $t('message.sign.add_signature') }}</p>
	</button>
</template>

<script setup lang="ts">
	import { FeatureFlag, useSettings } from '@/logic/store/settings';

	const settings = useSettings();
	const signedMessagesEnabled = settings.isFeatureEnabled(FeatureFlag.signedMessages);
</script>
