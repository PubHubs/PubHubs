import { defineStore } from 'pinia';

import { Optional } from 'matrix-events-sdk';
import { MatrixClient, EventTimeline } from 'matrix-js-sdk';

import { Authentication } from '@/core/authentication';
import { Events } from '@/core/events';
import { useSettings, useUser, useRooms } from '@/store/store';

const usePubHubs = defineStore('pubhubs', {
    state: () => {
        return {
            Auth: new Authentication(),
            client: {} as MatrixClient,
        };
    },

    getters: {
        getBaseUrl(state) {
            return state.Auth.getBaseUrl();
        },
    
    },

    actions: {
        centralLogin() {
            // @ts-ignore
            const centralLoginUrl = _env.PARENT_URL + '/login';
            window.top?.location.replace(centralLoginUrl);
        },

        async login() {
            console.log('PubHubs.login');
            try {
                const matrixClient = await this.Auth.login();
                this.client = matrixClient as MatrixClient;
                const events = new Events();
                events.startWithClient(this.client as MatrixClient);
                await events.initEvents();
                this.updateRooms();
                const user = useUser();
                const newUser = this.client.getUser(user.user.userId);
                if (newUser != null) {
                    user.setUser(newUser);
                    user.fetchDisplayName(this.client as MatrixClient);
                }
            } catch (error) {
                if (typeof error == 'string' && error.indexOf('M_FORBIDDEN') < 0) {
                    console.debug('ERROR:', error);
                }
            }
        },

        logout() {
            this.Auth.logout();
        },

        updateRooms() {
            console.log('PubHubs.updateRooms');
            const rooms = useRooms();
            const currentRooms = this.client.getRooms();
            rooms.updateRoomsWithMatrixRooms(currentRooms);
        },

        /**
         * Helpers
         */

        showDialog(message: string) {
            alert(message);
        },

        showError(error: string) {
            const message = 'Unfortanatly an error occured. Please contact the developers.\n\n' + error;
            this.showDialog(message);
        },

        /**
         * Wrapper methods for matrix client
         */

        async getPublicRooms(search: string) {
            return await this.client.publicRooms({
                limit: 10,
                filter: {
                    generic_search_term: search,
                },
            });
        },

        async getAllPublicRooms() {
            return await this.client.publicRooms({
                limit: 1000,
                filter: {
                    generic_search_term: "",
                },
            });
        },

        async joinRoom(roomId: string, router: any, search: string) {
            //
            const response = await this.getPublicRooms(search);
            try {
                await this.client.joinRoom(roomId);
                this.updateRooms();
            } catch (error) {
                // it returns an unknown type. Only option seems like to typecast to string.
                // Better to use the exact reason as the condition instead of status code.
                if (String(error).includes('M_FORBIDDEN')) {
                    console.info('Is Forbidden');
                    // User is forbidden but it is because it is secured room he is trying to access.
                    if (response.chunk[0].room_type === 'ph.messages.restricted') {
                        router.push({ name: 'secure-room', params: { id: roomId } });
                        
                    } else {
                        // If not then there is some other issue. Show the error message.
                        this.showError(error as string);
                    }
                }
            }
        },

        newRoom(options: object) {
            this.client.createRoom(options);
        },

        leaveRoom(roomId: string) {
            this.client.leave(roomId);
        },

        addMessage(roomId: string, text: string) {
            const content = {
                body: text,
                msgtype: 'm.text',
            };
            this.client.sendEvent(roomId, 'm.room.message', content, '');
        },

        addImage(roomId: string, uri: string) {
            this.client.sendImageMessage(roomId, uri);
        },

        async changeDisplayName(name: string) {
            try {
                this.client.setDisplayName(name);
            } catch (error) {
                this.showError(error as string);
            }
        },

        async loadOlderEvents(roomId: string) {
            const self = this;
            return new Promise((resolve) => {
                const room = self.client.getRoom(roomId);
                if (room != null) {
                    const firstEvent = room.timeline[0].event;
                    if (firstEvent !== undefined && firstEvent.type !== 'm.room.create') {
                        const timelineSet = room.getTimelineSets()[0];
                        const eventId = firstEvent.event_id;
                        if (eventId !== undefined) {
                            self.client
                                .getEventTimeline(timelineSet, eventId)
                                .then((eventTimeline: Optional<EventTimeline>) => {
                                    if (eventTimeline) {
                                        const settings = useSettings();
                                        resolve(
                                            self.client.paginateEventTimeline(eventTimeline, {
                                                backwards: true,
                                                limit: settings.pagination,
                                            })
                                        );
                                    } else {
                                        resolve(false);
                                    }
                                })
                                .catch((error: string) => {
                                    self.showError(error);
                                });
                        }
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            });
        },
    },
});

export { usePubHubs };
