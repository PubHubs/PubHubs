<template>
	<Dialog
		:title="dialogTitle"
		:width="isMobile ? 'px-8 w-full' : 'w-[600px] px-8'"
		class="z-50"
		@close="close()"
	>
		<!-- Loading state while fetching profile -->
		<div
			v-if="isLoading"
			class="flex flex-col items-center justify-center p-8"
		>
			<p>{{ $t('state.loading') }}</p>
		</div>

		<!-- No profile set - prompt to set one -->
		<div
			v-else-if="!credentials"
			class="flex flex-col p-200"
			:class="isMobile ? 'w-full' : 'w-[450px]'"
		>
			<H3>{{ $t('expert.profile_required') }}</H3>
			<p class="text-on-surface-dim mb-4 text-sm">
				{{ $t('expert.profile_required_description') }}
			</p>
			<ButtonGroup>
				<Button
					variant="error"
					@click.stop.prevent="close()"
					>{{ $t('dialog.cancel') }}</Button
				>
				<Button @click.stop.prevent="openProfileDialog()">{{ $t('expert.set_profile') }}</Button>
			</ButtonGroup>
		</div>

		<!-- Enter verification type, note and sources -->
		<ValidatedForm
			v-else
			v-slot="{ isValidated }"
			class="flex flex-col p-200"
			:class="isMobile ? 'w-full' : 'w-[450px]'"
			@submit.prevent
		>
			<H3>{{ $t('expert.assess_message') }}</H3>
			<p class="text-on-surface-dim mb-4 text-sm">
				{{ $t('expert.verify_message_description', { credentials: credentials }) }}
			</p>

			<!-- Verification type selection -->
			<fieldset class="mb-4">
				<legend class="text-on-surface-dim mb-2 text-sm font-medium">{{ $t('expert.verification_type_label') }}</legend>
				<div class="flex flex-col gap-2">
					<label class="flex cursor-pointer items-center gap-2">
						<input
							v-model="verificationType"
							type="radio"
							value="verified"
							class="text-accent-success"
						/>
						<span class="text-accent-success font-medium">{{ $t('expert.type_verified') }}</span>
						<span class="text-on-surface-dim text-sm">– {{ $t('expert.type_verified_description') }}</span>
					</label>
					<label class="flex cursor-pointer items-center gap-2">
						<input
							v-model="verificationType"
							type="radio"
							value="falsified"
							class="text-error"
						/>
						<span class="text-error font-medium">{{ $t('expert.type_falsified') }}</span>
						<span class="text-on-surface-dim text-sm">– {{ $t('expert.type_falsified_description') }}</span>
					</label>
					<label class="flex cursor-pointer items-center gap-2">
						<input
							v-model="verificationType"
							type="radio"
							value="context"
							class="text-accent-primary"
						/>
						<span class="text-accent-primary font-medium">{{ $t('expert.type_context') }}</span>
						<span class="text-on-surface-dim text-sm">– {{ $t('expert.type_context_description') }}</span>
					</label>
				</div>
			</fieldset>

			<TextArea
				v-model="note"
				:validation="{ required: true, maxLength: 500 }"
				@keydown.esc.stop
				>{{ $t('expert.add_context_label') }}</TextArea
			>
			<div class="flex flex-col gap-100">
				<Label>{{ $t('expert.sources_label') }}</Label>
				<TextField
					v-for="(_, index) in sources"
					:key="index"
					v-model="sources[index]"
					:name="t('expert.sources_label') + ' ' + (index + 1)"
					:validation="{ maxLength: 200 }"
					:placeholder="$t('expert.source_placeholder')"
					@update:model-value="onSourceInput(index)"
					@keydown.esc.stop
				/>
			</div>
			<ButtonGroup>
				<Button
					variant="error"
					@click.stop.prevent="close()"
					>{{ $t('dialog.cancel') }}</Button
				>
				<Button
					type="submit"
					:disabled="!isValidated"
					@click.stop.prevent="submit()"
					>{{ $t('dialog.submit') }}</Button
				>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Label from '@hub-client/components/forms/elements/Label.vue';
	import TextArea from '@hub-client/components/forms/elements/TextArea.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Models
	import { type TExpertProfileContent, type TExpertVerificationType } from '@hub-client/models/events/TExpertEvent';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';

	// Types
	type Props = {
		eventId: string;
		initialNote?: string;
		initialSources?: string[];
		initialVerificationType?: TExpertVerificationType;
		roomId: string;
	};

	const props = withDefaults(defineProps<Props>(), {
		initialNote: undefined,
		initialSources: undefined,
		initialVerificationType: undefined,
	});

	const emit = defineEmits<{
		close: [];
		submit: [verificationType: TExpertVerificationType, note: string | undefined, sources: string[] | undefined];
		openProfile: [];
	}>();

	const { t } = useI18n();
	const settings = useSettings();
	const pubhubsStore = usePubhubsStore();
	const isMobile = computed(() => settings.isMobileState);
	const isEditMode = computed(() => !!props.initialVerificationType);
	const dialogTitle = computed(() => (isEditMode.value ? t('expert.edit_assessment') : t('expert.verify_message')));

	const MAX_SOURCES = 10;
	const note = ref('');
	const sources = ref<string[]>(['']);
	const verificationType = ref<TExpertVerificationType>('verified');

	const onSourceInput = (index: number) => {
		// Add a new empty field if the last field has content and we haven't reached max
		if (index === sources.value.length - 1 && sources.value[index].trim() && sources.value.length < MAX_SOURCES) {
			sources.value.push('');
		}
	};

	const isLoading = ref(true);
	const profile = ref<TExpertProfileContent | undefined>(undefined);

	const credentials = computed(() => profile.value?.credentials);

	onMounted(async () => {
		try {
			const event = pubhubsStore.client.getAccountData('pubhubs.expert_profile');
			profile.value = event?.getContent() as TExpertProfileContent | undefined;
		} catch {
			// Account data not set
			profile.value = undefined;
		}

		// Initialize with existing values if editing
		if (props.initialVerificationType) {
			verificationType.value = props.initialVerificationType;
		}
		if (props.initialNote) {
			note.value = props.initialNote;
		}
		if (props.initialSources && props.initialSources.length > 0) {
			sources.value = [...props.initialSources, ''];
		}

		isLoading.value = false;
	});

	const close = () => {
		emit('close');
	};

	const openProfileDialog = () => {
		emit('openProfile');
		close();
	};

	const parseSources = (): string[] | undefined => {
		const filtered = sources.value.map((s) => s.trim()).filter(Boolean);
		return filtered.length > 0 ? filtered : undefined;
	};

	const submit = () => {
		emit('submit', verificationType.value, note.value || undefined, parseSources());
	};
</script>
