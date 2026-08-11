// Packages
import { computed } from 'vue';
import { useRouter } from 'vue-router';

// Composables
import useGlobalScroll from '@hub-client/composables/useGlobalScroll';
import { useSidebar } from '@hub-client/composables/useSidebar';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

/**
 * What "back" means inside the hub, in one place. Every way of going back (the global client's
 * mobile back arrow, the swipe-back gesture) calls back(), so they cannot drift apart.
 *
 * canGoBack says whether the hub itself will consume a back action. The global client mirrors it
 * (MessageType.BackState) to know that a swipe must not scroll the hub out of view, because the
 * hub is going to handle that swipe instead.
 */
export function useBackNavigation() {
	const router = useRouter();
	const rooms = useRooms();
	const sidebar = useSidebar();
	const { scrollToStart } = useGlobalScroll();

	// An open forum post is a route, not component state: leaving it is a navigation back to the feed
	const forumPostIsOpen = computed(() => {
		const route = router.currentRoute.value;
		return route.name === 'room' && !!route.params.topicId && !!rooms.currentRoom?.isForumRoom();
	});

	const canGoBack = computed(() => sidebar.isOpen.value || forumPostIsOpen.value);

	/**
	 * Back priority: an open sidebar closes first, then an open forum post goes back to the post
	 * feed, and only when the hub has nothing left to close does the global client scroll back to
	 * the menu. Keep this ladder in sync with canGoBack: every step above the last one must be a
	 * state canGoBack reports as true, or the global client will let the scroll happen instead.
	 */
	function back() {
		if (sidebar.isOpen.value) {
			sidebar.close();
			return;
		}
		if (forumPostIsOpen.value) {
			const route = router.currentRoute.value;
			router.push({ name: 'room', params: { id: route.params.id as string } });
			return;
		}
		scrollToStart();
	}

	return {
		canGoBack,
		back,
	};
}
