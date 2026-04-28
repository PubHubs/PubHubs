<template>
	<div
		v-if="isVisible"
		ref="elContainer"
		class="scrollbar bg-surface fixed max-h-52 overflow-x-hidden overflow-y-auto rounded-lg shadow-lg"
		:style="getStyle()"
	>
		<ul>
			<li
				v-for="(item, index) in filteredItems"
				:key="index"
				class="group hover:bg-surface-high flex cursor-pointer items-center gap-2 px-4"
				@click.stop="clickedItem(item)"
			>
				<Avatar
					v-if="marker === '@' && isUser(item)"
					:avatar-url="userStore.userAvatar(item.userId)"
					:user-id="item.userId"
				/>
				<div class="flex max-w-3000 flex-col items-center py-2">
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
	import { ref } from 'vue';

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

	const { marker, isVisible, filteredItems, selectItem, shortId, getDisplayName, getId, isUser } = useMentionAutocomplete(
		() => props.msg,
		() => props.room,
	);

	function clickedItem(item: UserDetails | TPublicRoom) {
		const result = selectItem(item);
		emit('click', result.item, result.marker);
	}

	function getStyle() {
		if (!elContainer.value) return;
		return {
			left: `${props.left}px`,
			top: `${props.top - 40 - elContainer.value.clientHeight}px`,
		};
	}
</script>
