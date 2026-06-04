<template>
	<Dialog
		:title="capitalize($t('moderation.issue_timeout'))"
		:width="isMobile ? 'px-8 w-full' : 'w-[600px] px-8'"
		class="z-50"
		@close="close()"
	>
		<ValidatedForm
			v-slot="{ isValidated }"
			class="flex flex-col p-200"
			:class="isMobile ? 'w-full' : 'w-[450px]'"
			@submit.prevent
		>
			<H3>{{ capitalize($t('moderation.issue_timeout_info', { name: memberDisplayName })) }}</H3>

			<div class="flex gap-200">
				<TextField
					v-model="hours"
					class="w-1/2"
					:placeholder="'0'"
					type="number"
					:validation="{ isNumber: true, minValue: 0 }"
				>
					{{ capitalize($t('moderation.timeout_hours')) }}
				</TextField>
				<TextField
					v-model="minutes"
					class="w-1/2"
					:placeholder="'0'"
					type="number"
					:validation="{ minValue: 0, isNumber: true, maxValue: 59 }"
				>
					{{ capitalize($t('moderation.timeout_minutes')) }}
				</TextField>
			</div>

			<TextArea
				v-model="reason"
				:validation="{ required: true, maxLength: 500 }"
				@keydown.esc.stop
				>{{ capitalize($t('moderation.timeout_reason_label')) }}</TextArea
			>

			<ButtonGroup>
				<Button
					variant="error"
					@click.stop.prevent="close()"
					>{{ $t('dialog.cancel') }}</Button
				>
				<Button
					type="submit"
					:disabled="!isValidated || !hasDuration"
					@click.stop.prevent="onSubmit()"
					>{{ $t('dialog.submit') }}</Button
				>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { capitalize, computed, ref } from 'vue';

	// New design
	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import TextArea from '@hub-client/components/forms/elements/TextArea.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		memberId: string;
	}>();

	const emit = defineEmits<{
		close: [];
		submit: [durationMinutes: number, reason: string];
	}>();

	const settings = useSettings();
	const userStore = useUser();
	const isMobile = computed(() => settings.isMobileState);

	const hours = ref<number | undefined>(undefined);
	const minutes = ref<number | undefined>(undefined);
	const reason = ref('');

	const durationMinutes = computed(() => (hours.value ?? 0) * 60 + (minutes.value ?? 0));
	const hasDuration = computed(() => durationMinutes.value > 0);
	const memberDisplayName = computed(() => userStore.userDisplayName(props.memberId) ?? props.memberId);

	const close = () => {
		emit('close');
	};

	const onSubmit = () => {
		if (hasDuration.value) {
			emit('submit', durationMinutes.value, reason.value);
		}
		close();
	};
</script>
