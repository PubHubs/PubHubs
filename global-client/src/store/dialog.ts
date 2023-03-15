import { defineStore } from 'pinia'

/**
 * Global Dialog, uses components/ui/Dialog.vue component which is globally present in App.vue
 */


/**
 * DialogButton class with:
 * - label
 * - color
 * - action (return value)
 */
class DialogButton {
    label: string;
    color: string;
    action: any;

    constructor(label='',color='',action=false) {
        this.label = label;
        this.color = color;
        this.action = action;
    }
}

const buttonsOk : Array<DialogButton> = [
    new DialogButton('ok','blue',true),
]

const buttonsOkCancel : Array<DialogButton> = [
    new DialogButton('ok','blue',true),
    new DialogButton('cancel','red',false),
]

const buttonsSubmitCancel : Array<DialogButton> = [
    new DialogButton('submit','blue',true),
    new DialogButton('cancel','red',false),
]

const buttonsYesNo : Array<DialogButton> = [
    new DialogButton('yes','blue',true),
    new DialogButton('no','red',false),
]

/**
 * DailogProperties class with all the properties a dialog needs
 */
class DialogProperties {
    title : string;
    content : any;
    buttons : Array<DialogButton>;
    modal : Boolean;
    close : Boolean;

    constructor( title = "", content = "", buttons:Array<DialogButton> = [], modal = true, close = true ) {
        this.title = title;
        this.content = content;
        if ( buttons.length == 0 ) {
            this.buttons = buttonsOkCancel;
        }
        else {
            this.buttons = buttons;
        }
        this.modal = modal;
        this.close = close;
    }
}

/**
 * The main dialog store
 */
const useDialog = defineStore('dialog', {

    state: () => {
        return {
            visible : false as Boolean,
            properties : new DialogProperties(),
            resolveDialog : {} as any,
            callbacks : {} as { [index:string]: Function }
        }
    },

    getters: {

    },

    actions: {

        /**
         * Call this to show a generic dialog with the given properties.
         *
         * @param properties DialogProperties
         * @returns Promise with the answer of the pressed button
         */
        show( properties: DialogProperties | null = null ) {
            return new Promise((resolve) => {
                if (properties === null) {
                    this.properties = new DialogProperties();
                }
                else {
                    this.properties = properties;
                }
                this.visible = true;
                this.resolveDialog = resolve;
            })
        },

        /**
         * Closes and hides the dialog and retuns the answer
         *
         * @param returnValue the answer that will be given back
         */
        close( returnValue:any ) {
            this.visible = false;
            const callback = this.callbacks[returnValue];
            if (callback) {
                callback(returnValue);
            }
            if ( typeof(this.resolveDialog) === "function" ) {
                this.resolveDialog(returnValue);
            }
        },

        /**
         * Shows a simple confirm dialog with only an 'Ok' button.
         *
         * @param title Text in the header of the dialog
         * @param content @default[''] Text in the main area of the dialog
         * @returns
         */
        confirm( title:string,content:string = '' ) {
            return this.show( new DialogProperties(title,content,buttonsOk));
        },

        /**
         * Shows a simple confirm dialog with only the 'Ok' and 'Cancel' buttons.
         *
         * @param title Text in the header of the dialog
         * @param content @default[''] Text in the main area of the dialog
         * @returns
         */
        okcancel( title:string,content:string = '' ) {
            return this.show( new DialogProperties(title,content,buttonsOkCancel));
        },

        /**
         * Shows a simple confirm dialog with only the 'Yes' and 'No' buttons.
         *
         * @param title Text in the header of the dialog
         * @param content @default[''] Text in the main area of the dialog
         * @returns
         */
        yesno( title:string,content:string = '' ) {
            return this.show( new DialogProperties(title,content,buttonsYesNo));
        },


        addCallback(action:any, callback:Function) {
            this.callbacks[action] = callback;
        },

        removeCallback(action:any) {
            delete(this.callbacks[action]);
        }

    },

})

export { buttonsSubmitCancel, DialogButton, DialogProperties, useDialog }
