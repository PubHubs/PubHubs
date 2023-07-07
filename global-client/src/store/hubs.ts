import {defineStore} from 'pinia'
import {RouteParams} from 'vue-router'
import {Message, MessageBoxType, MessageType, Theme, useGlobal, useMessageBox, useSettings} from '@/store/store'


// Single Hub
class Hub {

    readonly hubId  : string;
    readonly url    : string;
    description     : string;
    logo            : string;
    unreadMessages  : number;

    constructor( hubId: string,  url: string, description?: string ) {
        this.hubId = hubId;
        this.url = url;
        if ( typeof(description)!=="undefined" ) {
            this.description = description;
        }
        else {
            this.description = hubId;
        }
        this.logo = '';
        this.unreadMessages = 0;
    }

}

// Array of Hubs
interface HubList extends Array<Hub> {}



const useHubs = defineStore('hubs', {

    state: () => {
        return {
            currentHubId    : '' as string,
            hubs            : {} as { [index: string]: Hub },
        }
    },

    getters: {

        hubsArray(state) :HubList {
            const values = Object.values(state.hubs);
            const hubs = values.filter( item => typeof(item?.hubId) !== "undefined" );
            return hubs;
        },

        sortedHubsArray() :HubList {
            const hubs:HubList = Object.assign([],this.hubsArray);
            hubs.sort( (a,b) => (a.description > b.description ? 1:-1) );
            return hubs;
        },


        hasHubs() {
            return this.hubsArray.length > 0;
        },

        hubExists: (state) => {
            return (hubId:string) => {
                return typeof(state.hubs[hubId])=="undefined"?false:true
            }
        },

        hub: (state) => {
            return (hubId:string) => {
                if (typeof(state.hubs[hubId])!="undefined") {
                    return state.hubs[hubId];
                }
                return undefined;
            }
        },

        currentHub(state) : Hub {
            return state.hubs[state.currentHubId];
        },

        currentHubExists(state):boolean {
            return this.hubExists(state.currentHubId);
        },

    },

    actions: {

        addHub( hub:Hub ) {
            this.hubs[hub.hubId] = Object.assign(new Hub(hub.hubId,hub.url),hub);
        },

        addHubs( hubs:HubList ) {
            hubs.forEach( (hub:Hub) => {
                this.addHub(hub);
            });
        },

        async changeHub( params:RouteParams ) {
            const hubId = params.id as string;
            const roomId = params.roomId as string;
            const self = this;

            const messagebox = useMessageBox();

            // Only change to a Hub if there is a hubId given
            if ( typeof(hubId)!=="undefined" ) {

                // Test if changing to current hub (through url for example)
                if ( hubId !== this.currentHubId || this.currentHubId =='' ) {
                    this.currentHubId = hubId;
                    console.log('changeHub',params,hubId,this.currentHubId, this.currentHubExists);

                    if ( this.currentHubExists ) {

                        // Start conversation with hub frame and sync latest settings
                        await messagebox.init( MessageBoxType.Parent, this.currentHub.url );

                        // Send global login time
                        const global = useGlobal();

                        const loginTime = global.loginTime;
                        messagebox.sendMessage(new Message(MessageType.GlobalLoginTime, loginTime));

                        // Send current theme
                        const settings = useSettings();
                        settings.sendTheme();

                        // Let hub navigate to given room
                        if ( roomId!==undefined && roomId!=="" ) {
                            messagebox.sendMessage( new Message( MessageType.RoomChange, roomId ) );
                        }

                        // Listen to room change
                        messagebox.addCallback( MessageType.RoomChange, (message:Message) => {
                            const roomId = message.content;
                            // TODO: find a way router can be part of a store that TypeScript swallows.
                            // @ts-ignore
                            this.router.push({name:'hub',params:{id:hubId,roomId:roomId}})
                        });

                        // Listen to sync settings
                        messagebox.addCallback( MessageType.Settings, (message:Message) => {
                            const settings = useSettings();
                            settings.setTheme(message.content as Theme);
                        });

                        // Listen to sync unreadmessages
                        messagebox.addCallback( MessageType.UnreadMessages, (message:Message) => {
                            self.hubs[hubId].unreadMessages = message.content as number;
                        });

                        // Listen to modal show/hide
                        messagebox.addCallback( MessageType.DialogShowModal, () => {
                            const global = useGlobal();
                            global.showModal();
                        });
                        messagebox.addCallback( MessageType.DialogHideModal, () => {
                            const global = useGlobal();
                            global.hideModal();
                        });

                    }

                }

            }
            else {
                this.currentHubId = "";
                messagebox.reset();
            }

        },

    },

})

export { Hub, HubList, useHubs }
