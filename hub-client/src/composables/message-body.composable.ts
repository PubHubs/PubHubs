// Packages
import { type MaybeRefOrGetter, computed, toValue } from 'vue';

// Composables
import { useMentionsDisplay } from '@hub-client/composables/mention-display.composable';

// Logic
import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';

/**
 * Composable for handling message body rendering with mentions and sanitization.
 * Used by Message.vue, MessageFile.vue, and MessageImage.vue.
 *
 * @param body - The raw message body text
 * @param phBody - The pre-processed body from eventTimeLineHandler (already sanitized)
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
	 * Sanitized body for direct rendering when no mentions are present.
	 * Uses ph_body if available (already sanitized), otherwise sanitizes raw body.
	 */
	const sanitizedBody = computed(() => {
		const ph = toValue(phBody);
		if (ph) {
			return ph;
		}
		return sanitizeHtml(toValue(body) || '');
	});

	return {
		messageSegments,
		hasAnyMentions,
		sanitizedBody,
	};
}

export { useMessageBody };
