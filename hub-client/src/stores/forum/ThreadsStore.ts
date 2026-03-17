/*

This is not final solution for prod

*/
import { ref } from 'vue';

const _activeReplyTopicKey = ref<string | null>(null);
const _activeEditTopicKey = ref<string | null>(null);

export function useReplyState() {
	const toggleReply = (topicKey: string) => {
		if (_activeReplyTopicKey.value === topicKey) {
			_activeReplyTopicKey.value = null;
		} else {
			_activeReplyTopicKey.value = topicKey;
		}
	};

	return {
		activeReplyTopicKey: _activeReplyTopicKey,
		toggleReply,
	};
}

export function useEditState() {
	const toggleEdit = (topicKey: string) => {
		if (_activeEditTopicKey.value === topicKey) {
			_activeEditTopicKey.value = null;
		} else {
			_activeEditTopicKey.value = topicKey;
		}
	};

	return {
		activeEditTopicKey: _activeEditTopicKey,
		toggleEdit,
	};
}
