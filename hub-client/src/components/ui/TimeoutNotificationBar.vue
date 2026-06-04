<template>
	<div
		v-if="!isExpired"
		class="bg-accent-orange/10 border-accent-orange rounded-t-base flex h-500 items-center justify-between gap-100 border-b px-200 py-150"
	>
		<div class="gap-050 flex min-w-0 flex-col">
			<div class="text-label-small text-accent-orange flex items-center gap-100">
				<Icon
					class="text-accent-orange shrink-0"
					size="sm"
					type="clock"
				/>
				<span class="font-semibold">{{ capitalize($t('moderation.you_are_timed_out')) }} {{ reason }}</span>
			</div>
		</div>
		<div class="text-label-tiny text-on-surface-dim flex items-center gap-100">
			<span>{{ $t('moderation.timeout_expires_in', { time: countdownText }) }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { capitalize, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	const props = defineProps<{
		timeoutUntil: number;
		reason: string;
	}>();

	const emit = defineEmits<{
		'timeout-expired': [];
	}>();

	const now = ref(Date.now());
	let intervalId: ReturnType<typeof setInterval> | null = null;

	onMounted(() => {
		intervalId = setInterval(() => {
			now.value = Date.now();
		}, 1000);
	});

	onBeforeUnmount(() => {
		if (intervalId !== null) {
			clearInterval(intervalId);
		}
	});

	const remainingMs = computed(() => Math.max(0, props.timeoutUntil - now.value));
	const isExpired = computed(() => remainingMs.value === 0);

	// Emit when timeout expires
	watch(isExpired, (expired) => {
		if (expired) {
			emit('timeout-expired');
		}
	});

	const countdownText = computed(() => {
		const totalSeconds = Math.floor(remainingMs.value / 1000);
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (days > 0) {
			return `${days}d ${hours}h ${minutes}m`;
		} else if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		} else {
			return `${seconds}s`;
		}
	});
</script>
