import { defineStore } from 'pinia'

import { Hub, HubList } from '@/store/hubs'
import { apiURLS, apiStatus, apiGET } from '@/core/api'
import {getCookie} from "typescript-cookie";
import { Buffer } from "buffer";

interface hubResponseItem {
    name:string;
    client_uri:string;
    description:string;
}

const useGlobal = defineStore('global', {

    state: () => {
        return {
            loggedIn : false,
            modalVisible : false,
            loginTime: ""
        }
    },

    getters: {

        isModalVisible(state) : Boolean {
            return state.modalVisible;
        },

    },

    actions: {

        async checkLogin() {
            if ( await apiStatus( apiURLS.bar ) ) {
                this.loggedIn = true;
                if (getCookie("PHAccount")) {
                    const base64Cookie = getCookie("PHAccount") as string; // see docs/API.md
                    this.loginTime = Buffer.from(base64Cookie, 'base64').toString('binary').split(".")[1];
                }

                return true;
            }
            else {
                this.loggedIn = false;
                return false;
            }
        },

        login() {
            window.location.replace(apiURLS.login);
        },

        logout() {
            this.loggedIn = false;
            window.location.replace(apiURLS.logout);
        },

        async getHubs() {
            const data = await apiGET<Array<hubResponseItem>>( apiURLS.hubs );
            const hubs = [] as HubList;
            data.forEach( (item:hubResponseItem) => {
                hubs.push( new Hub(item.name,item.client_uri,item.description) )
            });
            return hubs;
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
