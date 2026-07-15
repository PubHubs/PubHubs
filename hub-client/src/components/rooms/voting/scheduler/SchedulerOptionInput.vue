<template>
	<div class="gap-075 mb-100 flex flex-col items-start justify-start">
		<label class="text-label-small text-on-surface-dim">{{ $t('message.voting.option') }}</label>
		<div class="flex w-full items-center gap-100">
			<div class="relative grow">
				<button
					v-if="option.status === 'empty'"
					class="bg-surface-base outline-offset-thin outline-on-surface-dim focus:outline-button-blue w-full justify-start rounded px-175 py-100 text-left outline-2 focus:outline-3"
				>
					<VueDatePicker
						id="schedulerDatePickerInput"
						v-model="date"
						dark
						:is-24="is24HourFormat"
						:locale="locale"
						:min-date="new Date()"
						offset="20"
						range
						:six-weeks="'fair'"
						append-to-body
						@update:model-value="updateDateOption"
					>
						<template #trigger>
							<span class="text-on-surface-dim/75 text-label font-normal">{{ $t('message.voting.add_option') }}</span>
						</template>
						<template #action-preview="{ value }">
							<div class="text-left text-balance">
								{{ filters.getDateStr(value, is24HourFormat, d, true) }}
							</div>
						</template>
					</VueDatePicker>
				</button>
				<div
					v-else-if="option.status === 'filled'"
					class="bg-surface-base outline-offset-thin outline-on-surface-dim focus-within:outline-button-blue flex w-full items-center rounded px-175 py-100 outline-2 focus-within:outline-3"
				>
					<VueDatePicker
						v-model="date"
						dark
						:is-24="is24HourFormat"
						:locale="locale"
						:min-date="new Date()"
						offset="20"
						range
						:six-weeks="'fair'"
						append-to-body
						@internal-model-change="handleInternal"
						@update:model-value="updateDateOption"
					>
						<template #trigger>
							<span class="text-label">{{ filters.getDateStr(option.date, is24HourFormat, d) }}</span>
						</template>
						<template #action-preview="{ value }">
							<div class="text-left text-balance">
								{{ filters.getDateStr(value, is24HourFormat, d, true) }}
							</div>
						</template>
						<!-- Add a custom time picker overlay, because model-auto with range does not allow for changing the time for a single date. -->
						<template #time-picker-overlay>
							<div class="time-picker-overlay">
								<div v-if="isRangeComplete">
									<VueDatePicker
										v-model="time"
										auto-apply
										dark
										inline
										:range="rangeOptions"
										:time="time"
										:time-picker="true"
										@update:model-value="updateTime"
									/>
								</div>
								<div v-else>
									<VueDatePicker
										v-model="time"
										auto-apply
										dark
										inline
										:time="time"
										:time-picker="true"
										@update:model-value="updateTime"
									/>
								</div>
							</div>
						</template>
					</VueDatePicker>
					<Icon
						:as-button="true"
						class="hover:text-accent-red shrink-0 hover:cursor-pointer"
						size="sm"
						type="x"
						@click="emit('removeOption')"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { type SchedulerOption } from '@hub-client/models/events/voting/VotingTypes';

	// Stores
	import { TimeFormat, useSettings } from '@hub-client/stores/settings';

	import { languageLocale } from '@hub-client/i18n';

	const props = defineProps<{
		option: SchedulerOption;
	}>();

	const emit = defineEmits(['updateOption', 'removeOption']);
	const settings = useSettings();
	const { d, locale: i18nLocale } = useI18n();

	// Get the locale of the current language
	const locale = languageLocale[i18nLocale.value];

	const date = ref<[Date | null, Date | null]>([null, null]);
	const dateBeforeSaved = ref<[Date | null, Date | null]>([null, null]);
	const time = ref<{ hours: number; minutes: number } | Array<{ hours: number; minutes: number }>>();
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
			const plusOneHour = new Date(rounded.getTime() + 60 * 60 * 1000); // Add an hour to the rounded-xs current time
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

	const handleInternal = (dates: Date[] | null) => {
		if (dates && dates.length === 1) {
			dateBeforeSaved.value = [dates[0], null];
		} else if (dates) {
			dateBeforeSaved.value = [dates[0] ?? null, dates[1] ?? null];
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
		if (!dateBeforeSaved.value[0]) return;
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
