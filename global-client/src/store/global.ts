import { defineStore } from 'pinia'

import { Hub } from '@/store/hubs'

// @ts-ignore
const baseUrl = _env.PUBHUBS_URL;
const loginUrl = baseUrl + '/login';
const logoutUrl = baseUrl + '/logout';
const barAPI = baseUrl + '/bar/state';
const hubsAPI = baseUrl + '/bar/hubs';

const apiOptionsGET = {
    method : "GET",
}

const useGlobal = defineStore('global', {

    state: () => {
        return {
            loggedIn : false,
            modalVisible : false,
        }
    },

    getters: {

        isModalVisible(state) : Boolean {
            return state.modalVisible;
        },

    },

    actions: {

        checkLogin() : Promise<any> {
            const self = this;
            return new Promise((resolve,reject) => {
                fetch( barAPI, apiOptionsGET )
                    .then( (response) => {
                        if ( response.status==200 ) {
                            self.loggedIn = true;
                            resolve(true);
                        }
                        else {
                            self.loggedIn = false;
                            reject();
                        }
                    })
                    .catch(()=>{
                        reject();
                    });
            });
        },

        login() {
            window.location.replace(loginUrl);
        },

        logout() {
            this.loggedIn = false;
            window.location.replace(logoutUrl);
        },

        getHubs() {
            return new Promise((resolve) => {
                fetch( hubsAPI, apiOptionsGET )
                    .then( (response) => {
                        if ( response.status==200) {
                            response.json().then((data)=>{
                                const hubs = [] as Array<Hub>;
                                data.forEach( (item:any) => {
                                    hubs.push( new Hub(item.name,item.client_uri,item.description) )
                                });
                                resolve(hubs);
                            });
                        }
                    });
            });
        },

        showModal() {
            this.modalVisible = true;
        },

        hideModal() {
            this.modalVisible = false;
        },


    },

})

export { useGlobal }
