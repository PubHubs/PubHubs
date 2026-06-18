<template>
	<div class="mt-200 flex flex-col gap-400 px-200">
		<div class="flex items-center gap-200">
			<div class="bg-accent-primary text-on-accent-primary flex aspect-square h-300 w-300 items-center justify-center rounded-full">
				<span class="text-label-small font-semibold">i</span>
			</div>
			<H2>{{ $t('register.yivi_faq') }}</H2>
		</div>
		<div class="flex flex-col gap-200">
			<div
				v-for="(item, index) in faqs"
				:key="index"
				class="bg-surface-base border-surface-elevated flex w-full flex-col gap-100 rounded border-3"
			>
				<div
					class="flex w-full justify-between rounded px-200 py-100 font-semibold hover:cursor-pointer"
					:class="openIndex === index && 'border-surface-elevated/50 border-b-3'"
					@click="toggle(index)"
				>
					<span>{{ item.question }}</span>
					<span>{{ openIndex === index ? '−' : '+' }}</span>
				</div>
				<div
					v-if="openIndex === index"
					class="p-200"
				>
					{{ item.answer }}
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H2 from '@hub-client/components/elements/H2.vue';

	const { t } = useI18n();
	const openIndex = ref<number | null>(null);

	const faqs = computed(() => [
		{ question: t('register.yivi_faq_1_question'), answer: t('register.yivi_faq_1_answer') },
		{ question: t('register.yivi_faq_2_question'), answer: t('register.yivi_faq_2_answer') },
		{ question: t('register.yivi_faq_3_question'), answer: t('register.yivi_faq_3_answer') },
		{ question: t('register.yivi_faq_4_question'), answer: t('register.yivi_faq_4_answer') },
		{ question: t('register.yivi_faq_5_question'), answer: t('register.yivi_faq_5_answer') },
	]);

	function toggle(index: number) {
		openIndex.value = openIndex.value === index ? null : index;
	}
</script>
