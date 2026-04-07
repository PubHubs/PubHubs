<template>
	<div class="mt-4 flex flex-col gap-8 px-4">
		<div class="flex items-center gap-4">
			<div class="bg-accent-primary text-on-accent-primary flex aspect-square h-6 w-6 items-center justify-center rounded-full">
				<span class="text-label-small font-semibold">i</span>
			</div>
			<H2>{{ $t('register.yivi_faq') }}</H2>
		</div>
		<div class="flex flex-col gap-4">
			<div
				v-for="(item, index) in faqs"
				:key="index"
				class="bg-surface-low flex w-full flex-col gap-2 rounded-2xl"
			>
				<div
					class="flex w-full justify-between rounded-2xl px-4 py-2 font-semibold hover:cursor-pointer"
					:class="openIndex === index && 'bg-surface'"
					@click="toggle(index)"
				>
					<span>{{ item.question }}</span>
					<span>{{ openIndex === index ? '−' : '+' }}</span>
				</div>
				<div
					v-if="openIndex === index"
					class="p-4"
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
