<template>
	<div
		v-if="isVisible"
		ref="elContainer"
		class="scrollbar bg-surface fixed max-h-2500 overflow-x-hidden overflow-y-auto rounded-lg shadow-lg"
		:style="getStyle()"
	>
		<ul>
			<li
				v-for="(item, index) in filteredItems"
				:key="index"
				class="group flex cursor-pointer items-center gap-100 px-200"
				:class="index === selectedIndex ? 'bg-surface-elevated' : 'hover:bg-surface-elevated'"
				@click.stop="clickedItem(item)"
			>
				<Avatar
					v-if="marker === '@' && isUser(item)"
					:avatar-url="userStore.userAvatar(item.userId)"
					:user-id="item.userId"
				/>
				<div class="flex max-w-3000 flex-col items-center py-100">
					<TruncatedText :title="getDisplayName(item)">
						{{ getDisplayName(item) }}
					</TruncatedText>
					<TruncatedText class="text-on-surface-dim">
						{{ shortId(getId(item)) }}
					</TruncatedText>
				</div>
			</li>
		</ul>
	</div>
</template>

<script lang="ts" setup>
	import { nextTick, ref, watch } from 'vue';

	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	import { type MentionAutoCompleteProps, type UserDetails, useMentionAutocomplete } from '@hub-client/composables/mention-autocomplete.composable';

	import { type TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';

	import { useUser } from '@hub-client/stores/user';

	const props = withDefaults(defineProps<MentionAutoCompleteProps>(), {
		msg: undefined,
		left: 0,
		top: 0,
		room: undefined,
	});
	const emit = defineEmits(['click']);
	const userStore = useUser();
	const elContainer = ref<HTMLElement | null>(null);
	const selectedIndex = ref(0);

	const { marker, isVisible, filteredItems, selectItem, shortId, getDisplayName, getId, isUser } = useMentionAutocomplete(
		() => props.msg,
		() => props.room,
	);

	watch(filteredItems, () => {
		selectedIndex.value = 0;
	});

	function clickedItem(item: UserDetails | TPublicRoom) {
		const result = selectItem(item);
		emit('click', result.item, result.marker);
	}

	function scrollSelectedIntoView() {
		nextTick(() => {
			const listItems = elContainer.value?.querySelectorAll('li');
			listItems?.[selectedIndex.value]?.scrollIntoView({ block: 'nearest' });
		});
	}

	/**
	 * Handles keyboard navigation events from parent.
	 * @returns true if the event was handled and should be prevented
	 */
	function handleNavigation(e: KeyboardEvent): boolean {
		if (!isVisible.value || filteredItems.value.length === 0) {
			return false;
		}

		switch (e.key) {
			case 'ArrowUp':
				selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : filteredItems.value.length - 1;
				scrollSelectedIntoView();
				return true;
			case 'Tab':
			case 'ArrowDown':
				selectedIndex.value = selectedIndex.value < filteredItems.value.length - 1 ? selectedIndex.value + 1 : 0;
				scrollSelectedIntoView();
				return true;
			case 'Enter':
				clickedItem(filteredItems.value[selectedIndex.value]);
				return true;
			default:
				return false;
		}
	}

	defineExpose({ handleNavigation, isVisible });

	function getStyle() {
		if (!elContainer.value) return;
		const menuWidth = elContainer.value.clientWidth;
		const padding = 16;
		const maxLeft = window.innerWidth - menuWidth - padding;
		const clampedLeft = Math.max(padding, Math.min(props.left, maxLeft));

		return {
			left: `${clampedLeft}px`,
			top: `${props.top - 40 - elContainer.value.clientHeight}px`,
		};
	}
</script>
