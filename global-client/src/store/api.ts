/**
 *
 * This store has generic API functions, to make fetches to PubHubs Central easier. (Remembering etag etc.)
 *
 */

import { defineStore } from 'pinia'

let baseUrl = '';
// @ts-ignore
if ( typeof(_env) !== 'undefined' ) {
    // @ts-ignore
    baseUrl = _env.PUBHUBS_URL;
}

const apiURLS = {
    'login'     : baseUrl + '/login',
    'logout'    : baseUrl + '/logout',
    'bar'       : baseUrl + '/bar/state',
    'hubs'      : baseUrl + '/bar/hubs',
}

interface ApiOptions {
    method:string;
    body?:string;
    headers?: Object;
}

const apiOptionsGET:ApiOptions = {
    method : "GET",
}

const apiOptionsPOST:ApiOptions = {
    method : "POST",
}

const apiOptionsPUT:ApiOptions = {
    method : "PUT",
}


const useApi = defineStore('api', {

    state: () => {
        return {
            etag : '',
        }
    },

    actions : {

        fetchEtagFromHeaders(headers:Headers) : string {
            if ( headers.get('etag') ) {
                this.etag = headers.get('etag') as string;
            }
            return this.etag;
        },

        isJsonResponse(headers:Headers) : boolean {
            if ( headers.get('content-type') == "application/json" ) {
                return true;
            }
            if ( headers.get('content-type') == "application/octet-stream" && headers.get('content-length')!="0"  ) {
                return true;
            }
            return false;
        },

        async api<T>( url:string, options:ApiOptions = apiOptionsGET ): Promise<T> {
            const response = await fetch(url,options as RequestInit);
            if ( !response.ok ) {
                return false as T;
            }
            this.fetchEtagFromHeaders(response.headers);
            if ( response.status == 204 ) {
                return true as T;
            }
            if (this.isJsonResponse(response.headers)) {
                return response.json() as Promise<T>;
            }
            return response as T;
        },

        async apiGET<T>( url:string ) : Promise<T> {
            return this.api<T>( url, apiOptionsGET );
        },

        async apiPOST<T>( url:string, data:any ) : Promise<T> {
            const options = apiOptionsPOST;
            options.body = JSON.stringify(data);
            return this.api<T>( url, options );
        },

        async apiPUT<T>( url:string, data:any, etag:boolean = false ) : Promise<T> {
            const options = apiOptionsPUT;
            options.headers = {
                "Content-Type": "application/octet-stream",
            }
            if (etag) {
                options.headers = {
                    "Content-Type": "application/octet-stream",
                    "If-Match": this.etag,
                }
            }
            options.body = JSON.stringify(data);
            return this.api<T>( url, options );
        },

    }

})

export { apiURLS, apiOptionsGET, apiOptionsPOST, apiOptionsPUT, useApi }
