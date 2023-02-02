import logger from 'loglevel';
import { MatrixClient } from 'matrix-js-sdk';

import { Authentication } from '@/core/authentication';
import { Events } from '@/core/events';

import { useSettings, useUser, useRooms } from '@/store/store';


class PubHubs {

    private Auth = new Authentication();
    private Events:any;

    private settings: any;
    private user: any;
    private rooms: any;

    private client!: MatrixClient;


    constructor() {
        this.settings = useSettings();
        this.rooms = useRooms();
        this.user = useUser();

        logger.getLogger('matrix').setLevel(5);
        console.info(' ');
        console.info('[============= PubHubs ================]');
        console.debug(' ');

        this.startClient();
    }

    startClient() {
        const self = this;
        this.Auth.login().then( (client:any) => {
            self.client = client as MatrixClient;
            self.Events = new Events(self.client);
            self.Events.initEvents().then(()=>{
                self.updateRooms();
                const newUser = this.client.getUser(this.user.user.userId);
                if (newUser != null) {
                    self.user.setUser(newUser);
                    self.user.fetchDisplayName(self.client);
                }
            });
        },(error)=>{
            if ( typeof(error)=="string" && error.indexOf('M_FORBIDDEN')<0 ) {
                console.debug('ERROR:', error);
            }
        });
    }

    logout() {
        this.Auth.logout();
    }

    updateRooms() {
        const rooms = this.client.getRooms();
        this.rooms.updateRoomsWithMatrixRooms(rooms);
    }

    /**
     * Helpers
     */

    showDialog(message:string) {
        alert(message);
    }

    showError(error:string) {
        const message = "Helaas, er is een fout opgetreden. Neem contact op met de developers.\n\n" + error;
        this.showDialog(message);
    }

    /**
     * Wrapper methods for matrix client
     */

    getPublicRooms(search: string) {
        return this.client.publicRooms({
            limit: 10,
            filter: {
                generic_search_term: search,
            },
        });
    }

    joinRoom(roomId: string) {
        const self = this;
        this.client.joinRoom(roomId).then(() => {
            self.updateRooms();
        }).catch((error)=> {
            this.showError(error);
        });
    }

    newRoom(options: object) {
        this.client.createRoom(options);
    }

    leaveRoom(roomId: string) {
        this.client.leave(roomId);
    }

    addMessage(roomId: string, text: string) {
        const content = {
            "body": text,
            "msgtype": "m.text"
        }
        this.client.sendEvent(roomId, "m.room.message", content, "");
    }

    changeDisplayName(name: string) {
        this.client.setDisplayName(name).then(() => {
            // PubHubsState.setDisplayName(name);
        }).catch((error: any) => {
            this.showError(error);
        });
    }

    getUsersDisplayNameByID(userId: string) {
        if (this.user.user.userId == userId) {
            return this.user.user.displayName;
        }
        return userId;
    }

    loadOlderEvents(roomId: string) {
        const self = this;
        return new Promise(function (resolve) {
            const room = self.client.getRoom(roomId);
            if (room != null) {
                const firstEvent = room.timeline[0].event;
                if (firstEvent !== undefined && firstEvent.type !== 'm.room.create') {
                    const timelineSet = room.getTimelineSets()[0];
                    const eventId = firstEvent.event_id;
                    if (eventId !== undefined) {
                        self.client.getEventTimeline(timelineSet, eventId).then(
                            (eventTimeline: any) => {
                                resolve(self.client.paginateEventTimeline(eventTimeline, { backwards: true, limit: self.settings.pagination }));
                            }
                        ).catch((error) => {
                            self.showError(error);
                        });
                    }
                }
                else {
                    resolve(false);
                }
            }
            else {
                resolve(false);
            }
        });
    }

}


export { PubHubs }
