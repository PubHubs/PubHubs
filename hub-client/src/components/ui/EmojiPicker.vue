<template>
	<div class="border-2 p-2 rounded max-h-auto max-w-xs bg-white dark:bg-gray-dark">
		<div class="flex flex-wrap justify-center">
			<div v-for="(image, index) in imageList" :key="index" class="icons" @click="index == 0 || index == 1 ? selectEmojiByGroup() : selectEmojiByGroup(index)">
				<Icon v-if="index != 1" :type="image" class="w-[25px] m-[3px]" :class="{ 'border-b-2': selectedGroup === index }"></Icon>
			</div>
			<input class="m-1 px-1 text-black rounded border-2 w-full bg-gray-200" v-model="searchQuery" type="text" placeholder="Search" />

			<div class="overflow-y-scroll break-words max-h-80 max-w-md">
				<p>
					{{ groupLabel() }}
				</p>
				<span v-for="emoji in filterEmojis" :key="emoji.hexcode" @click="selectEmoji(emoji)" class="cursor-pointer text-2xl m-1 tracking-[.45em]">
					{{ emoji.emoji }}
				</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref, computed } from 'vue';
	import { Emoji, fetchEmojis } from 'emojibase';

	const emojis = ref([] as Emoji[]);
	const searchQuery = ref('');
	const selectedGroup = ref(undefined);
	const emit = defineEmits(['emojiSelected']);

	// Update this with new icons.
	const imageList = [
		'home',
		'', /// Empty because there are two categories of smileys and we merge them.
		'close',
		'plus',
		'remove',
		'chevron-down',
		'chevron-up',
		'cog',
		'edit',
		'circle',
	];

	onMounted(async () => {
		const emojiData = await fetchEmojis('en');
		emojis.value = emojiData.filter((emoji) => {
			return !emoji.label.includes('regional');
		});
	});

	const filterEmojis = computed(() => {
		let filtered = emojis.value;

		if (selectedGroup.value) {
			filtered = emojis.value.filter((emoji) => emoji.group === selectedGroup.value);

			// only smileys
			if (selectedGroup.value === 2) {
				const onlySmiley = emojis.value.filter((emoji) => {
					return emoji.group == 1;
				});
				filtered = onlySmiley.concat(filtered);
				const withAdditionalSmiles = emojis.value.filter((emoji) => {
					return emoji.group == 0;
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

	function selectEmojiByGroup(group: Number = 0) {
		selectedGroup.value = group;
	}

	function selectEmoji(emoji: Emoji) {
		emit('emojiSelected', emoji.emoji);
	}

	function groupLabel() {
		const labels = [
			// Concatenate group 0,1,2 in the same group as they are similar in nature.
			'', //0
			'', //1
			'Smileys & People', //2
			'Animals & Nature', //3
			'Food & Drink', //4
			'Travel & Places', //5
			'Activities', //6
			'Lifestyle', //7
			'Symbols', //8
			'Flag', //9
		];

		return labels[selectedGroup.value];
	}
</script>
