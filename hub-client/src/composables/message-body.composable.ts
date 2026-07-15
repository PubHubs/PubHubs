// Packages
import { type MaybeRefOrGetter, computed, toValue } from 'vue';

// Composables
import { useMentionsDisplay } from '@hub-client/composables/mention-display.composable';

/**
 * Composable for handling message body rendering with mentions and sanitization.
 * Used by Message.vue, MessageFile.vue, and MessageImage.vue.
 *
 * @param body - The raw message body text
 * @param phBody - The pre-processed body from eventTimeLineHandler
 */
function useMessageBody(body: MaybeRefOrGetter<string | undefined>, phBody: MaybeRefOrGetter<string | undefined>) {
	const mentionComposable = useMentionsDisplay();

	/**
	 * Parse message body into segments with mentions identified.
	 * Uses raw body for parsing - text segments should be escaped at render time with textToHtml().
	 */
	const messageSegments = computed(() => {
		const bodyValue = toValue(body) || '';
		const mentions = mentionComposable.parseMentions(bodyValue);
		return mentionComposable.buildSegments(bodyValue, mentions);
	});

	/**
	 * Whether the message contains any mentions (user or room).
	 */
	const hasAnyMentions = computed(() => messageSegments.value.some((seg) => seg.type !== 'text'));

	/**
	 * Body for direct rendering when no mentions are present. Sanitized at render time by v-safe-html.
	 * Named messageBody (not sanitizedBody) because sanitization happens in the directive, not here.
	 */
	const messageBody = computed(() => {
		const ph = toValue(phBody);
		if (ph) return ph;
		return toValue(body) || '';
	});

	return {
		messageSegments,
		hasAnyMentions,
		messageBody,
	};
}

export { useMessageBody };
