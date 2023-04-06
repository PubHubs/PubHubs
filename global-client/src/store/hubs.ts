import { defineStore } from 'pinia'
import { MessageType, Message, MessageBoxType, useMessageBox, Theme, useSettings, useGlobal } from '@/store/store'

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


const useHubs = defineStore('hubs', {

    state: () => {
        return {
            currentHubId    : '' as string,
            hubs            : {} as { [index: string]: Hub },
        }
    },

    getters: {

        hubsArray(state) :Array<Hub> {
            const values = Object.values(state.hubs);
            const hubs = values.filter( item => typeof(item?.hubId) !== "undefined" );
            return hubs;
        },

        sortedHubsArray() :Array<Hub> {
            const hubs:Array<Hub> = Object.assign([],this.hubsArray);
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

        addHubs( hubs:Array<Hub> ) {
            hubs.forEach( (hub:Hub) => {
                this.addHub(hub);
            });
        },

        changeHub( params:any ) {
            const hubId = params.id;
            const roomId = params.roomId;
            const self = this;

            const messagebox = useMessageBox();

            console.info('changeHub',params,hubId,'current:',this.currentHubId);

            // Only change to a Hub if there is a hubId given
            if ( typeof(hubId)!=="undefined" ) {

                // Test if changing to current hub (through url for example)
                if ( hubId !== this.currentHubId || this.currentHubId =='' ) {
                    this.currentHubId = hubId;

                    console.info('changeHub (2)');

                    if ( this.currentHub !== undefined ) {

                        console.info('changeHub (3)');

                        // Start conversation with hub frame and sync latest settings
                        messagebox.init( MessageBoxType.Parent, this.currentHub.url ).then(()=>{

                            console.info('changeHub (4) Messagebox Ready');

                            // Send current settings
                            const settings = useSettings();
                            settings.sendSettings();

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
                                settings.setTheme(message.content.theme as Theme);
                            });

                            // Listen to sync unreadmessages
                            messagebox.addCallback( MessageType.UnreadMessages, (message:Message) => {
                                self.hubs[hubId].unreadMessages = message.content;
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

export { Hub, useHubs }
