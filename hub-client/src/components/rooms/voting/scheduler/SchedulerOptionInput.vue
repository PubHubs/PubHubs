<template>
	<button v-if="option.status === 'empty'" class="relative mb-1 flex h-[42px] w-full rounded-lg border bg-background text-left hover:bg-surface-high">
		<div class="mx-2 flex w-full items-center">
			<VueDatePicker id="schedulerDatePickerInput" class="" offset="20" v-model="date" :six-weeks="'fair'" :is-24="is24HourFormat" :locale="locale" range dark :min-date="new Date()" @update:model-value="updateDateOption">
				<template #trigger>
					<p class="flex-1 ~text-label-min/label-max">{{ $t('message.voting.add_option') }}</p>
				</template>
				<template #action-preview="{ value }">
					<div class="text-balance text-left">{{ filters.getDateStr(value, is24HourFormat, d, true) }}</div>
				</template>
			</VueDatePicker>
		</div>
	</button>
	<button v-else-if="option.status === 'filled'" class="mb-1 flex h-[42px] w-full items-center justify-between rounded-lg border bg-background hover:bg-surface-high">
		<div class="flex w-full">
			<VueDatePicker v-model="date" :six-weeks="'fair'" :is-24="is24HourFormat" :locale="locale" range dark :min-date="new Date()" class="m-auto min-w-10" @internal-model-change="handleInternal" @update:model-value="updateDateOption">
				<template #trigger>
					<div class="mx-2 text-left">
						<div>{{ filters.getDateStr(option.date, is24HourFormat, d) }}</div>
					</div>
				</template>
				<template #action-preview="{ value }">
					<div class="text-balance text-left">{{ filters.getDateStr(value, is24HourFormat, d, true) }}</div>
				</template>
				<!-- Add a custom time picker overlay, because model-auto with range does not allow for changing the time for a single date. -->
				<template #time-picker-overlay>
					<div class="time-picker-overlay">
						<div v-if="isRangeComplete">
							<VueDatePicker v-model="time" auto-apply inline dark :range="rangeOptions" :time-picker="true" :time="time" @update:modelValue="updateTime" />
						</div>
						<div v-else>
							<VueDatePicker v-model="time" auto-apply inline dark :time-picker="true" :time="time" @update:modelValue="updateTime" />
						</div>
					</div>
				</template>
			</VueDatePicker>
			<Icon type="bin" :as-button="true" size="sm" :icon-color="'text-accent-red'" @click="emit('removeOption')" class="m-auto mr-2"></Icon>
		</div>
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { SchedulerOption } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { TimeFormat, useSettings } from '@hub-client/stores/settings';

	const emit = defineEmits(['updateOption', 'removeOption']);
	const settings = useSettings();
	const { d, locale } = useI18n();

	const props = defineProps<{
		option: SchedulerOption;
	}>();

	const date = ref<[Date | null, Date | null]>([null, null]);
	const dateBeforeSaved = ref();
	const time = ref();
	const rangeOptions = ref({ disableTimeRangeValidation: false });

	const is24HourFormat = computed(() => {
		return settings.timeformat === TimeFormat.format24;
	});

	const isRangeComplete = computed(() => {
		return dateBeforeSaved.value[1] !== null;
	});

	function getTime(date: Date) {
		return {
			hours: date.getHours(),
			minutes: date.getMinutes(),
		};
	}

	onMounted(() => {
		if (props.option.date.length === 0) {
			const coeff = 1000 * 60 * 5;
			const rounded = new Date(Math.ceil(Date.now() / coeff) * coeff); // Current time rounded up to 5 minutes
			const plusOneHour = new Date(rounded.getTime() + 60 * 60 * 1000); // Add an hour to the rounded current time
			date.value = [rounded, plusOneHour];
			time.value = [getTime(rounded), getTime(plusOneHour)];
		} else {
			const startDate = new Date(props.option.date[0]);
			let endDate = null;
			if (props.option.date[1] !== null) {
				endDate = new Date(props.option.date[1]);
				time.value = [getTime(startDate), getTime(endDate)];
			} else {
				time.value = getTime(startDate);
			}
			date.value = [startDate, endDate];
		}
	});

	const handleInternal = (dates: any) => {
		if (dates && dates.length === 1) {
			dateBeforeSaved.value = [dates[0], null];
		} else if (dates) {
			dateBeforeSaved.value = dates;
			time.value = [getTime(dates[0]), getTime(dates[1])];
			if (equalDayMonthYear(dates[0], dates[1])) {
				// If we have a range with the same start and end day, the start time needs to be before the end time.
				rangeOptions.value = { disableTimeRangeValidation: false };
			} else {
				// In other cases, we can have an end time that is before the start time.
				// E.g. April 24, 2025, 13:00 - April 27, 2025, 10:00
				rangeOptions.value = { disableTimeRangeValidation: true };
			}
		}
	};

	function equalDayMonthYear(date1: Date, date2: Date) {
		const normalizedDate1 = new Date(date1); // Dates are copied so that the originals are not modified
		const normalizedDate2 = new Date(date2);

		normalizedDate1.setHours(0, 0, 0, 0); // Dates are normalized by setting the time to midnight
		normalizedDate2.setHours(0, 0, 0, 0);

		return normalizedDate1.getTime() === normalizedDate2.getTime();
	}

	const updateTime = (time: { hours: number; minutes: number } | Array<{ hours: number; minutes: number }>) => {
		if (!Array.isArray(time)) {
			time = [time]; // Convert to an array if we get a single time object
		}
		const updatedStartDate = new Date(dateBeforeSaved.value[0]);
		updatedStartDate.setHours(time[0].hours, time[0].minutes);
		let updatedEndDate = null; // The updated end date will be null if we do not have a complete range selected
		if (dateBeforeSaved.value[1] !== null) {
			updatedEndDate = new Date(dateBeforeSaved.value[1]);
			updatedEndDate.setHours(time[1].hours, time[1].minutes);
		}
		date.value = [updatedStartDate, updatedEndDate];
	};

	function updateDateOption() {
		emit('updateOption', date.value);
	}
</script>
