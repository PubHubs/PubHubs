import { defineStore } from 'pinia'

const baseUrl = process.env.VUE_APP_BASEURL!.toString();
const loginUrl = baseUrl + '/login';
const logoutUrl = baseUrl + '/logout';
const barAPI = baseUrl + '/bar/state';

const apiOptionsGET = {
    method : "GET",
}

const useGlobal = defineStore('global', {

    state: () => {
        return {
            loggedIn : false,
        }
    },

    getters: {

    },

    actions: {

        checkLogin() : Promise<any> {
            console.log('checkLogin');
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

    },

})

export { useGlobal }
