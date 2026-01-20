// Packages
import { Direction } from 'matrix-js-sdk';
import { type Ref, computed, nextTick, ref } from 'vue';

import { SystemDefaults } from '@hub-client/models/constants';
import type Room from '@hub-client/models/rooms/Room';

export function useTimelinePagination(container: Ref<HTMLElement | null>, room: Room) {
	const isLoadingPrevious = ref(false);
	const isLoadingNext = ref(false);

	/**
	 * Check if the oldest message in the timeline is loaded
	 */
	const oldestEventIsLoaded = computed(() => {
		return room.isOldestMessageLoaded();
	});

	/**
	 * Check if the newest message in the timeline is loaded
	 */
	const newestEventIsLoaded = computed(() => {
		return room.isNewestMessageLoaded();
	});

	/**
	 * Loads previous
	 */
	async function loadPrevious(): Promise<void> {
		if (isLoadingPrevious.value) return;

		isLoadingPrevious.value = true;

		const cont = container.value;
		if (!cont) {
			isLoadingPrevious.value = false;
			return;
		}

		const prevOldestEventId = room.getTimelineOldestMessageId();

		if (prevOldestEventId && !oldestEventIsLoaded.value) {
			// Store scroll position before loading
			const prevScrollHeight = cont.scrollHeight;
			const prevScrollTop = cont.scrollTop;

			// Load older messages
			await room.paginate(Direction.Backward, SystemDefaults.roomTimelineLimit, prevOldestEventId);

			// Wait for DOM update
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));

			// Restore scroll position
			// In column-reverse, new content at visual top increases scrollHeight
			// Adjust scrollTop to maintain the same view
			const heightDiff = cont.scrollHeight - prevScrollHeight;
			cont.scrollTop = prevScrollTop + heightDiff;
		}

		isLoadingPrevious.value = false;
	}

	/**
	 * Loads next
	 */
	async function loadNext(): Promise<void> {
		if (isLoadingNext.value) return;

		isLoadingNext.value = true;

		const prevNewestEventId = room.getTimelineNewestMessageEventId();

		if (prevNewestEventId && !newestEventIsLoaded.value) {
			// Load newer messages
			await room.paginate(Direction.Forward, SystemDefaults.roomTimelineLimit, prevNewestEventId);

			// Wait for DOM update
			await nextTick();
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}

		isLoadingNext.value = false;
	}

	return {
		loadPrevious,
		loadNext,
		isLoadingPrevious: computed(() => isLoadingPrevious.value),
		isLoadingNext: computed(() => isLoadingNext.value),
		oldestEventIsLoaded,
		newestEventIsLoaded,
	};
}
