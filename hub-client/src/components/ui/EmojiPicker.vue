<template>
	<div
		v-click-outside="close"
		class="bg-surface flex h-[30rem] w-full max-w-[30rem] flex-col rounded-2xl p-4"
	>
		<input
			v-model="searchQuery"
			class="bg-background text-on-surface text-label placeholder:text-on-surface-dim w-full rounded-md border-none py-2"
			:placeholder="$t('others.search')"
			type="text"
		/>
		<div class="flex flex-row justify-between border-b py-3">
			<template
				v-for="(image, index) in imageList"
				:key="index"
			>
				<Icon
					v-if="index !== 1"
					class="cursor-pointer"
					:class="{ 'border-b-2': selectedGroup === index }"
					size="md"
					:type="image"
					@click="index === 0 || index === 1 ? selectEmojiByGroup() : selectEmojiByGroup(index)"
				/>
			</template>
		</div>
		<p>
			{{ $t('emoji.' + groupLabel()) }}
		</p>

		<div class="scrollbar emoji-font flex flex-wrap gap-2 overflow-y-auto pr-2">
			<span
				v-for="emoji in filterEmojis"
				:key="emoji.hexcode"
				class="text-body-min/base-max flex cursor-pointer items-center justify-center overflow-hidden"
				@click="selectEmoji(emoji)"
			>
				{{ emoji.emoji }}
			</span>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type Emoji } from 'emojibase';
	import { computed, onMounted, ref } from 'vue';

	// Locales
	import emojiData from '@hub-client/locales/emojidata';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const emit = defineEmits(['close', 'emojiSelected']);
	const logger = createLogger('EmojiPicker');
	const settings = useSettings();
	const language = settings.getActiveLanguage;
	const emojis = ref([] as Emoji[]);
	const searchQuery = ref('');
	const selectedGroup = ref(0);
	// Update this with new icons.
	const imageList = [
		'clock',
		'', /// Empty because there are two categories of smileys and we merge them.
		'smiley',
		'dog',
		'coffee',
		'house',
		'basketball',
		'lightbulb',
		'globe',
		'flag',
	];

	onMounted(() => {
		const data = emojiData[language];
		if (data) {
			emojis.value = data.filter((emoji) => !emoji.label.includes('regional'));
		} else {
			logger.error(`No emoji data available for language "${language}"`);
		}
	});

	const filterEmojis = computed(() => {
		let filtered = emojis.value;

		if (selectedGroup.value) {
			filtered = emojis.value.filter((emoji) => emoji.group === selectedGroup.value);

			// only smileys
			if (selectedGroup.value === 2) {
				const onlySmiley = emojis.value.filter((emoji) => {
					return emoji.group === 1;
				});
				filtered = onlySmiley.concat(filtered);
				const withAdditionalSmiles = emojis.value.filter((emoji) => {
					return emoji.group === 0;
				});
				filtered = withAdditionalSmiles.concat(filtered);
			}
		}

		if (searchQuery.value) {
			filtered = filtered.filter((emoji) => {
				const searchCriterion = emoji.shortcodes ? emoji.shortcodes[0] : emoji.label;
				return searchCriterion.toLowerCase().includes(searchQuery.value.toLowerCase());
			});
		}

		return filtered;
	});

	function selectEmojiByGroup(group: number = 0) {
		selectedGroup.value = group;
	}

	function selectEmoji(emoji: Emoji) {
		emit('emojiSelected', emoji.emoji);
	}

	function groupLabel() {
		const labels = [
			// Concatenate group 0,1,2 in the same group as they are similar in nature.
			'clock', //0
			'', //1
			'smiley', //2
			'bear', //3
			'cup', //4
			'house', //5
			'basketball', //6
			'lightbulb', //7
			'signs', //8
			'flag', //9
		];

		return labels[selectedGroup.value];
	}

	function close() {
		emit('close');
	}
</script>
