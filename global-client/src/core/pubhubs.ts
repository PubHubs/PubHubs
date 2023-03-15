import { useSettings, useUser } from '@/store/store';


class PubHubs {

    private settings: any;
    private user: any;


    constructor() {
        this.settings = useSettings();
        this.user = useUser();

        console.info(' ');
        console.info('[============= PubHubs ================]');
        console.info('Use the console wisely ;-)');
        console.log(' ');
    }

}


export { PubHubs }
