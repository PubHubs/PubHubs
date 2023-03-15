import { setActivePinia, createPinia } from 'pinia'
import { describe, beforeEach, expect, test, vi } from 'vitest'
import { Message, MessageType, MessageBoxType, useMessageBox } from '@/store/messagebox'


let messages = [];
const mockTarget = () => {
    return {
        postMessage : (message:any,url:string) => {
            messages.push({'message':message,'url':url});
        }
    }
}


describe('MessageBox Store', () => {

    let messageboxParent = {} as useMessageBox;
    let messageboxChild = {} as useMessageBox;

    beforeEach(() => {
        setActivePinia(createPinia())
        messageboxParent = useMessageBox();
        messageboxChild = useMessageBox();
    })

    describe('idle', () => {

        test('default', () => {
            expect( messageboxParent.isReady ).toBe(false);
            expect( messageboxParent.isConnected ).toBe(false);
            expect( messageboxChild.isReady ).toBe(false);
            expect( messageboxChild.isConnected ).toBe(false);
            expect( messageboxChild.inIframe ).toBe(false);
        })

    })

    describe('connect', () => {

        test('Parent', () => {
            const spyWindowAddEventListener = vi.spyOn(window,'addEventListener');
            vi.stubGlobal('top', 'parent');
            vi.stubGlobal('self', 'parent');

            // init
            messageboxParent.init( MessageBoxType.Parent, 'http://parent' );
            expect(spyWindowAddEventListener).toHaveBeenCalled();
            expect(window.top).toBe('parent');
            expect(window.self).toBe('parent');
            expect(messageboxParent.inIframe).toBe(false);
            expect(messageboxParent.isReady).toBe(false);

            // ready
            messageboxParent.type = MessageBoxType.Parent;
            messageboxParent.handshake = 'ready';
            expect(messageboxParent.isReady).toBe(true);
            expect(messageboxParent.isConnected).toBe(true);

            // send message
            const message = new Message(MessageType.UnreadMessages,4);

            messageboxParent.resolveTarget = mockTarget;
            const spyResolveTarget = vi.spyOn(messageboxParent,'resolveTarget');
            const currentMessagesLen = messages.length;
            messageboxParent.sendMessage( message, 'http://parent' );
            expect(spyResolveTarget).toBeCalled();
            expect(messages.length).toBe(currentMessagesLen+1);

            // Receive same message and test if callback works
            const callbackObj = {
                fake: () => {console.log('FAKE CALLBACK')},
            }
            const spyOnCallback = vi.spyOn(callbackObj,'fake');
            messageboxParent.addCallback(MessageType.UnreadMessages,callbackObj.fake);
            expect(Object.keys(messageboxParent.callbacks).length).toBe(1);
            messageboxParent.receivedMessage(message);
            expect(spyOnCallback).toBeCalledTimes(1);
        })

        test('Child', () => {
            const spyWindowAddEventListener = vi.spyOn(window,'addEventListener');
            vi.stubGlobal('top', 'parent');
            vi.stubGlobal('self', 'child');

            messageboxChild.init( MessageBoxType.Child, 'http://child' );
            expect(spyWindowAddEventListener).toHaveBeenCalled();
            expect(window.top).toBe('parent');
            expect(window.self).toBe('child');
            expect(messageboxChild.inIframe).toBe(true);
            expect(messageboxChild.isReady).toBe(false);
            expect(messageboxChild.state = 'started');
        })


    })

})
