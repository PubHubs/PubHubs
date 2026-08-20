// Packages
import { defineStore } from 'pinia';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';
import { ApiError } from '@hub-client/logic/core/apiCore';
import { createLogger } from '@hub-client/logic/logging/Logger';
import { delay } from '@hub-client/logic/utils/common';

// Modelsu
import { type TNotification, TNotificationType } from '@hub-client/models/users/TNotification';

const logger = createLogger('Notifications');

const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_ATTEMPTS = 3;

const isRetryable = (error: unknown): boolean => !(error instanceof ApiError) || error.status >= 500;

export const useNotifications = defineStore('notifications', {
	state: () => ({
		notifications: [] as TNotification[],
	}),
	actions: {
		async fetchSecuredRoomNotifications(): Promise<TNotification[]> {
			for (let attempt = 0; attempt < FETCH_MAX_ATTEMPTS; attempt++) {
				try {
					const newNotifications = await api_synapse.apiGET<TNotification[]>(
						`${api_synapse.apiURLS.data}?data=removed_from_secured_room`,
						AbortSignal.timeout(FETCH_TIMEOUT_MS),
					);

					// Only add notifications that are not already in the list (by room_id and type)
					newNotifications.forEach((n: TNotification) => {
						if (!this.notifications.some((existing: TNotification) => existing.room_id === n.room_id && existing.type === n.type)) {
							this.notifications.push(n);
						}
					});
					break;
				} catch (error) {
					const lastAttempt = attempt === FETCH_MAX_ATTEMPTS - 1;
					if (lastAttempt || !isRetryable(error)) {
						logger.error('Could not retrieve secured room notifications', error);
						break;
					}
					logger.warn(`Could not retrieve secured room notifications (attempt ${attempt + 1}/${FETCH_MAX_ATTEMPTS}), retrying`, error);
					await delay(attempt);
				}
			}
			return this.notifications;
		},
		async removeNotification(roomId?: string, type: TNotificationType = TNotificationType.Default): Promise<void> {
			let index = -1;
			if (roomId) {
				index = this.notifications.findIndex((n: TNotification) => n.room_id === roomId);
			} else {
				index = this.notifications.findIndex((n: TNotification) => n.type === type);
			}
			if (index !== -1) {
				this.notifications.splice(index, 1);
			}

			if (roomId && type === TNotificationType.RemovedFromSecuredRoom) {
				// If the notification is for being removed from a secured room, also remove the allowed join row in the database
				await this.removeAllowedJoinRoomRow(roomId);
			}
		},
		async removeAllowedJoinRoomRow(roomId: string): Promise<void> {
			try {
				await api_synapse.apiPOST(`${api_synapse.apiURLS.data}?data=remove_allowed_join_room_row`, { room_id: roomId });
			} catch (error) {
				logger.error(`Could not remove notification for room ${roomId}`, error);
			}
		},
	},
});
