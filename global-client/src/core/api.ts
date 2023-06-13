/**
 *
 * This module has generic API fetch functions, to make fetches to PubHubs Central easier.
 *
 */



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
}

const apiOptionsGET:ApiOptions = {
    method : "GET",
}

const apiOptionsPOST:ApiOptions = {
    method : "POST",
}


const apiStatus = async ( url:string, options:ApiOptions = apiOptionsGET ): Promise<boolean> => {
    const response = await fetch(url,options);
    if ( response.status == 200 ) {
        return true;
    }
    return false;
}


const api = async <T>( url:string, options:ApiOptions = apiOptionsGET ): Promise<T> => {
    const response = await fetch(url,options);
    if ( !response.ok ) {
        throw new Error(response.statusText)
    }
    return response.json() as Promise<T>
}

const apiGET = async <T>( url:string ) : Promise<T> => {
    return api<T>( url, apiOptionsGET );
}

const apiPOST = async <T>( url:string ) : Promise<T> => {
    return api<T>( url, apiOptionsPOST );
}


export { apiURLS, apiOptionsGET, apiOptionsPOST,apiStatus, apiGET, apiPOST }
