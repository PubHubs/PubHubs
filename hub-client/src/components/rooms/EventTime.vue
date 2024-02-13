<template>
	<span ref="eventtime" class="text-xs font-normal"> {{ dayString }} <span v-if="dayString">|</span> {{ timeformat.formatTimestamp(timestamp) }}</span>
	<div v-if="isVisible" class="fixed top-20 right-1/4 mr-0 border p-0 px-1 w-32 bg-white rounded-md text-center">{{ dateString }}</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, computed } from 'vue';
	import { useTimeFormat } from '@/composables/useTimeFormat';
	import { useI18n } from 'vue-i18n';
	import { useSettings, featureFlagType } from '@/store/store';
	const settings = useSettings();
	const timeformat = useTimeFormat();
	const { t } = useI18n();

	const props = defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
	});

	const isVisible = ref(false);

	// TODO: use observe API when ready, for now just this fast hack that does work a bit...
	const eventtime = ref(null);
	const timelineEl = ref(null as HTMLElement | null);

	if (settings.isFeatureEnabled(featureFlagType.dateSplitter)) {
		timelineEl.value = document.getElementById('room-timeline');
		timelineEl.value?.addEventListener('scroll', () => {
			calcVisibility();
		});
		onMounted(() => {
			calcVisibility();
		});
	}
	function calcVisibility() {
		if (settings.isFeatureEnabled(featureFlagType.dateSplitter) && eventtime.value) {
			const ypos = eventtime.value.getBoundingClientRect().y;
			const maxPos = timelineEl.value?.offsetHeight;
			if (ypos < 0) {
				isVisible.value = false;
			} else {
				if (maxPos && ypos < maxPos) {
					isVisible.value = true;
				}
			}
		}
	}
	// Hack until here...

	const dateString = computed(() => {
		const date = new Date(props.timestamp);
		return date.toLocaleDateString();
	});

	const dayString = computed(() => {
		const date = new Date(props.timestamp);
		const today = new Date();

		const daysDiff = today.getDate() - date.getDate();
		const monthsDiff = today.getMonth() - date.getMonth();
		const yearsDiff = today.getFullYear() - date.getFullYear();

		if (yearsDiff === 0 && daysDiff === 0 && monthsDiff === 0) {
			return '';
		} else if (yearsDiff === 0 && daysDiff === 1) {
			return t('time.yesterday');
		} else if (yearsDiff === 0 && daysDiff > 1 && daysDiff < 3) {
			return t('time.daysago', [daysDiff]);
		}

		return dateString.value;
	});
</script>
