<template>
	<Dialog
		:title="$t('expert.edit_profile')"
		:width="isMobile ? 'px-8 w-full' : 'w-[600px] px-8'"
		class="z-50"
		@close="close()"
	>
		<!-- Loading state -->
		<div
			v-if="isLoading"
			class="flex flex-col items-center justify-center p-8"
		>
			<p>{{ $t('state.loading') }}</p>
		</div>

		<ValidatedForm
			v-else
			v-slot="{ isValidated }"
			class="flex flex-col p-200"
			:class="isMobile ? 'w-full' : 'w-[450px]'"
			@submit.prevent
		>
			<H3>{{ $t('expert.profile_description') }}</H3>
			<TextField
				v-model="credentials"
				:validation="{ required: true, maxLength: 200 }"
				@keydown.esc.stop
				>{{ $t('expert.credentials') }}</TextField
			>
			<div class="flex flex-col gap-100">
				<div class="flex items-end gap-100">
					<TextField
						v-model="specializationInput"
						:validation="{ maxLength: 50 }"
						class="grow"
						@keydown.enter.prevent="addSpecialization()"
						@keydown.esc.stop
						>{{ $t('expert.specializations') }}</TextField
					>
					<Button
						:disabled="!specializationInput.trim()"
						@click.stop.prevent="addSpecialization()"
						>{{ $t('admin.add') }}</Button
					>
				</div>
				<div
					v-if="specializations.length > 0"
					class="gap-050 flex flex-wrap"
				>
					<span
						v-for="(specialization, index) in specializations"
						:key="index"
						class="group bg-surface-elevated text-on-primary gap-050 py-050 inline-flex items-center rounded-xl px-100"
					>
						{{ specialization }}
						<button
							type="button"
							class="group-hover:text-accent-red-interactive cursor-pointer"
							@click="removeSpecialization(index)"
						>
							<Icon
								type="x"
								size="sm"
							/>
						</button>
					</span>
				</div>
			</div>
			<TextField
				v-model="institution"
				:validation="{ required: false, maxLength: 100 }"
				@keydown.esc.stop
				>{{ $t('expert.institution') }}</TextField
			>
			<ButtonGroup>
				<Button
					variant="error"
					@click.stop.prevent="close()"
					>{{ $t('dialog.cancel') }}</Button
				>
				<Button
					type="submit"
					:disabled="!isValidated"
					@click.stop.prevent="onSubmit()"
					>{{ $t('dialog.save') }}</Button
				>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Models
	import { type TExpertProfileContent } from '@hub-client/models/events/TExpertEvent';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';

	const emit = defineEmits<{
		close: [];
		submit: [profile: TExpertProfileContent];
	}>();

	const settings = useSettings();
	const pubhubsStore = usePubhubsStore();
	const isMobile = computed(() => settings.isMobileState);

	const isLoading = ref(true);
	const credentials = ref('');
	const specializations = ref<string[]>([]);
	const specializationInput = ref('');
	const institution = ref('');

	const addSpecialization = () => {
		const value = specializationInput.value.trim();
		if (value && !specializations.value.includes(value)) {
			specializations.value.push(value);
			specializationInput.value = '';
		}
	};

	const removeSpecialization = (index: number) => {
		specializations.value.splice(index, 1);
	};

	onMounted(async () => {
		try {
			const event = pubhubsStore.client.getAccountData('pubhubs.expert_profile');
			const profile = event?.getContent() as TExpertProfileContent | undefined;
			if (profile) {
				credentials.value = profile.credentials ?? '';
				specializations.value = profile.specializations ?? [];
				institution.value = profile.institution ?? '';
			}
		} catch {
			// Account data not set
		}
		isLoading.value = false;
	});

	const close = () => {
		emit('close');
	};

	const onSubmit = () => {
		const profile: TExpertProfileContent = {
			credentials: credentials.value,
		};

		if (specializations.value.length > 0) {
			profile.specializations = specializations.value;
		}

		if (institution.value.trim()) {
			profile.institution = institution.value.trim();
		}

		emit('submit', profile);
	};
</script>
