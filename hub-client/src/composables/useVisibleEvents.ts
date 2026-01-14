// Packages
import { type Ref, ref } from 'vue';

export function useVisibleEvents(container: Ref<HTMLElement | null>) {
	/**
	 * Set of event IDs that are currently visible in the viewport (updated by IntersectionObserver)
	 */
	const visibleEventIds = ref<Set<string>>(new Set());

	/**
	 * Gets the event ID of the first visible event in the timeline
	 *
	 * @returns Event ID of first visible event, or null if none visible
	 */
	function getFirstVisibleEventId(): string | null {
		if (!container.value) return null;

		const containerRect = container.value.getBoundingClientRect();

		for (const child of Array.from(container.value.querySelectorAll('[id]'))) {
			const rect = (child as HTMLElement).getBoundingClientRect();

			// Check if element's bottom is below the container's top
			if (rect.bottom > containerRect.top) {
				return (child as HTMLElement).id;
			}
		}

		return null;
	}

	/**
	 * Gets the event ID of the last visible event in the timeline
	 *
	 * @returns Event ID of last visible event, or null if none visible
	 */
	function getLastVisibleEventId(): string | null {
		if (!container.value) {
			console.warn('[VisibleEvents] getLastVisibleEventId: no container');
			return null;
		}

		const containerRect = container.value.getBoundingClientRect();
		let lastVisibleId: string | null = null;
		let visibleCount = 0;

		// Iterate through all elements with IDs
		for (const child of Array.from(container.value.querySelectorAll('[id]'))) {
			const rect = (child as HTMLElement).getBoundingClientRect();

			// Check if element is visible in viewport
			if (rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
				lastVisibleId = (child as HTMLElement).id;
				visibleCount++;
			}
		}

		console.warn('[VisibleEvents] getLastVisibleEventId:', { lastVisibleId, visibleCount, containerHeight: containerRect.height });
		return lastVisibleId;
	}

	/**
	 * Gets all event IDs that are currently visible in the viewport
	 *
	 * @returns Array of visible event IDs
	 */
	function getVisibleEventIds(): string[] {
		if (!container.value) return [];

		const containerRect = container.value.getBoundingClientRect();
		const visible: string[] = [];

		for (const child of Array.from(container.value.querySelectorAll('[id]'))) {
			const rect = (child as HTMLElement).getBoundingClientRect();

			if (rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
				visible.push((child as HTMLElement).id);
			}
		}

		return visible;
	}

	return {
		getFirstVisibleEventId,
		getLastVisibleEventId,
		getVisibleEventIds,
		visibleEventIds,
	};
}
