<template>
	<div class="mx-auto mt-20 flex w-6/12 flex-col gap-2 text-center">
		<H2 v-if="hubName" class="mb-4">{{ `${t('home.hub_homepage_welcome')} ${hubName}` }}</H2>
		<HubIcon v-if="hubName" :hub-name="hubName" :icon-url="hubSettings.iconUrlLight" :icon-url-dark="hubSettings.iconUrlDark" class="mx-auto max-h-20 max-w-24"></HubIcon>
		<P class="mb-2">{{ t('onboarding.info_first_time') }}</P>
		<P class="mb-2">{{ t('onboarding.info_abt_pseudonym') }}</P>
		<P class="mb-0 text-2xl text-green">{{ pseudonym }}</P>
		<P class="mb-2">{{ t('onboarding.info_issue_identity') }}</P>

		<TextInput v-if="!submitted" class="mb-2 rounded border p-2 text-center focus:border-blue focus:outline-none" placeholder="example: PubHubs" @changed="updateData($event)"></TextInput>
		<P class="mb-2 text-sm">{{ t('onboarding.info_abt_choose_later') }}</P>
		<P class="mb-2">{{ t('onboarding.info_abt_nickname_use') }}</P>
		<P class="mb-4">{{ t('onboarding.info_abt_yivi_room') }}</P>
		<P class="mb-2 text-sm">{{ t('onboarding.info_misbehave') }}</P>
		<Button v-if="!submitted" class="mx-24" @click="submitAndClose">{{ t('onboarding.continue') }}</Button>
		<div v-if="submitted">
			<P class="mb-0 text-2xl text-green">{{ t('onboarding.update') }}!</P>
		</div>
	</div>

	<div v-if="submitted" class="mx-auto mt-2 flex w-6/12 flex-row justify-center space-x-4 text-center">
		<Icon type="tick"></Icon>
		<P>{{ t('onboarding.success_msg') }}</P>
	</div>
	<div v-if="laterSubmit" class="mx-auto mt-2 text-center">
		<P>{{ t('onboarding.later') }}</P>
		<P>{{ t('onboarding.success_msg') }}</P>
	</div>
</template>

<script setup lang="ts">
	import HubIcon from '@/components/ui/HubIcon.vue';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useHubSettings } from '@/logic/store/hub-settings';
	import { useUser } from '@/logic/store/user';
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const pubhubs = usePubHubs();
	const user = useUser();
	const hubSettings = useHubSettings();
	const hubName = ref(hubSettings.hubName);

	let submitted = ref(false);
	let laterSubmit = ref(false);
	let pseudonym = ref(user.user.userId.split(':')[0].substring(1));
	// Initialize to user Id - because we are asking user to set it later. We keep a check on displayName update based on userId.
	let displayName = user.user.userId;

	function updateData(name: string) {
		displayName = name;
	}

	async function submit() {
		laterSubmit.value = false;
		await pubhubs.changeDisplayName(displayName);
	}

	async function submitAndClose() {
		if (displayName.charAt(0) !== '@') {
			submitted.value = true;
			submit();
		} else {
			// If user doesn't set his nickname
			laterSubmit.value = true;
		}
	}
</script>
