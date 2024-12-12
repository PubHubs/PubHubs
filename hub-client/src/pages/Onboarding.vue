<template>
	<HeaderFooter :headerSize="'sm'">
		<template #header> </template>
		<div class="flex flex-col p-8 max-w-lg mx-auto gap-4">
			<div>
				<H2>{{ t('home.hub_homepage_welcome', [settings.hub.name]) }}</H2>
				<Logo class="max-w-24 max-h-20"></Logo>
			</div>
			<div>
				<P>{{ t('onboarding.info_first_time') }}</P>
				<P>{{ t('onboarding.info_abt_pseudonym') }}</P>
			</div>

			<P class="text-green text-2xl">{{ pseudonym }}</P>
			<P>{{ t('onboarding.info_issue_identity') }}</P>

			<div>
				<TextInput v-if="!submitted" class="p-2 border rounded focus:outline-none focus:border-blue mb-2" :placeholder="t('onboarding.nickname_placeholder')" @changed="updateData($event)"></TextInput>
				<P class="text-sm">{{ t('onboarding.info_abt_choose_later') }}</P>
			</div>

			<div class="flex flex-col gap-2">
				<P>{{ t('onboarding.info_abt_nickname_use') }}</P>
				<P>{{ t('onboarding.info_abt_yivi_room') }}</P>
				<P class="text-sm">{{ t('onboarding.info_misbehave') }}</P>
			</div>
			<div v-if="submitted">
				<P class="text-green text-2xl">{{ t('onboarding.update') }}!</P>
			</div>
			<Button v-else class="w-fit px-2" @click="submitAndClose">{{ t('onboarding.continue') }}</Button>
			<div v-if="submitted" class="flex flex-row justify-center space-x-4">
				<Icon type="tick"></Icon>
				<P>{{ t('onboarding.success_msg') }}</P>
			</div>
			<div v-if="laterSubmit">
				<P>{{ t('onboarding.later') }}</P>
				<P>{{ t('onboarding.success_msg') }}</P>
			</div>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useSettings } from '@/store/settings';
	import { useUser } from '@/store/user';
	import { ref } from 'vue';

	import { useI18n } from 'vue-i18n';
	const { t } = useI18n();
	const pubhubs = usePubHubs();
	const user = useUser();
	const settings = useSettings();

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
