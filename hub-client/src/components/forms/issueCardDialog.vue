<template>
	<Dialog
		:title="cardType === 'yellow' ? capitalize($t('moderation.issue_yellow_card')) : capitalize($t('moderation.issue_red_card'))"
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
			<H3> {{ cardType === 'yellow' ? capitalize($t('moderation.issue_yellow_card_info')) : capitalize($t('moderation.issue_red_card_info')) }}</H3>
			<TextArea
				v-model="reason"
				:validation="{ required: true, maxLength: 500 }"
				@keydown.esc.stop
				>{{ capitalize($t('moderation.card_reason_label')) }}</TextArea
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
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	import Button from '@hub-client/new-design/components/Button.vue';
	import ButtonGroup from '@hub-client/new-design/components/ButtonGroup.vue';
	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';
	import ValidatedForm from '@hub-client/new-design/components/forms/ValidatedForm.vue';

	defineProps<{
		cardType: 'yellow' | 'red';
	}>();
	const emit = defineEmits<{
		close: [];
		submit: [reason: string];
	}>();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const reason = ref('');

	function close() {
		emit('close');
	}

	function onSubmit() {
		emit('submit', reason.value);
		close();
	}
</script>
