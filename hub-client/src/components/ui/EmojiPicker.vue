<template>
	<div class="flex h-80 w-full max-w-80 flex-col rounded-2xl bg-lightgray-light p-4 dark:bg-gray-darker" v-click-outside="close">
		<input class="h-7 w-full rounded placeholder:text-base dark:bg-gray-middle dark:text-white dark:placeholder:text-white" v-model="searchQuery" type="text" :placeholder="$t('others.search')" @keydown.stop="preventClose()" />
		<div class="flex flex-row gap-2 border-b border-gray-light py-3">
			<template v-for="(image, index) in imageList" :key="index">
				<Icon :class="{ 'border-b-2': selectedGroup === index }" @click="index === 0 || index === 1 ? selectEmojiByGroup() : selectEmojiByGroup(index)" v-if="index !== 1" :type="image" class="w-6 cursor-pointer pb-1"></Icon>
			</template>
		</div>
		<p>
			{{ $t('emoji.' + groupLabel()) }}
		</p>

		<div class="scrollbar emoji-font flex flex-wrap gap-2 overflow-y-auto pr-2">
			<span v-for="emoji in filterEmojis" :key="emoji.hexcode" @click="selectEmoji(emoji)" class="flex cursor-pointer items-center justify-center overflow-hidden text-xl">
				{{ emoji.emoji }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref, computed } from 'vue';

	import { useSettings } from '@/store/settings';

	import { Emoji } from 'emojibase';

	const settings = useSettings();
	const language = settings.getActiveLanguage;

	// Fetching data file for emoji from localized dataset.
	const data = require(`emojibase-data/${language}/data.json`);

	const emojis = ref([] as Emoji[]);
	const searchQuery = ref('');
	const selectedGroup = ref(0);
	const emit = defineEmits(['close', 'emojiSelected']);

	// Update this with new icons.
	const imageList = [
		'emoji_clock',
		'', /// Empty because there are two categories of smileys and we merge them.
		'emoji_smiley',
		'emoji_bear',
		'emoji_cup',
		'emoji_house',
		'emoji_basketball',
		'emoji_lightbulb',
		'emoji_signs',
		'emoji_flag',
	];

	onMounted(async () => {
		try {
			emojis.value = data.filter((emoji: Emoji) => {
				return !emoji.label.includes('regional');
			});
		} catch (error) {
			console.error('An error occurred while fetching the emojis:', error);
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

	async function close() {
		emit('close');
	}

	function preventClose() {
		// Does nothing, but needed to add this comment:
		// @keydown.stop attribute on the input is needed for preventing to close the popup
		// Due to the MessageInput component that sees every keystroke as a reason to close all popups.
	}
</script>
