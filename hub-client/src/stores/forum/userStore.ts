import { defineStore } from 'pinia';

export enum UserInteraction {
	NONE = 0,
	LIKED = 1,
	DISLIKED = 2,
}

export const useUserInteractionsStore = defineStore('userInteractions', {
	state: () => ({
		interactions: {} as Record<string, UserInteraction>,
	}),
	getters: {
		get: (state) => {
			return (topicKey: string): UserInteraction => state.interactions[topicKey] || UserInteraction.NONE;
		},
		hasLiked: (state) => {
			return (topicKey: string): boolean => state.interactions[topicKey] === UserInteraction.LIKED;
		},
		hasDisliked: (state) => {
			return (topicKey: string): boolean => state.interactions[topicKey] === UserInteraction.DISLIKED;
		},
	},
	actions: {
		like(topicKey: string) {
			this.interactions[topicKey] = UserInteraction.LIKED;
		},
		dislike(topicKey: string) {
			this.interactions[topicKey] = UserInteraction.DISLIKED;
		},
		removeInteraction(topicKey: string) {
			delete this.interactions[topicKey];
		},
		toggleInteraction(topicKey: string, current: UserInteraction, target: UserInteraction): UserInteraction {
			if (current === target) {
				this.removeInteraction(topicKey);
				return UserInteraction.NONE;
			}
			this.interactions[topicKey] = target;
			return target;
		},
	},
});
