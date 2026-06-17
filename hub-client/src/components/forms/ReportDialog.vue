<template>
	<Dialog
		:title="capitalize($t('moderation.report_message'))"
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
			<H3>{{ capitalize($t('moderation.report_message_info')) }}</H3>
			<TextArea
				v-model="reason"
				:validation="{ required: true, maxLength: 500 }"
				@keydown.esc.stop
				>{{ capitalize($t('moderation.report_reason_label')) }}</TextArea
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
					>{{ $t('dialog.submit') }}</Button
				>
			</ButtonGroup>
		</ValidatedForm>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { capitalize, computed, ref } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import TextArea from '@hub-client/components/forms/elements/TextArea.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const emit = defineEmits<{
		close: [];
		submit: [reason: string];
	}>();

	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const reason = ref('');

	const close = () => {
		emit('close');
	};

	const onSubmit = () => {
		emit('submit', reason.value);
		close();
	};
</script>
