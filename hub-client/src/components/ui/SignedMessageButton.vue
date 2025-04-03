<template>
	<button v-if="signedMessagesEnabled" class="flex flex-col items-center p-4" @click="$emit('click', $event)">
		<Icon type="sign" />
		<p>{{ $t('message.sign.add_signature') }}</p>
	</button>
</template>

<script setup lang="ts">
	import { FeatureFlag, useSettings } from '@/logic/store/settings';

	const settings = useSettings();
	const signedMessagesEnabled = settings.isFeatureEnabled(FeatureFlag.signedMessages);
</script>
