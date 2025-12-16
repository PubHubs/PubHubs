// Packages
import { defineStore } from 'pinia';

// Logic
import filters from '@hub-client/logic/core/filters';

// Stores
import { Theme, TimeFormat, useSettings } from '@hub-client/stores/settings';

/**
 * This store is used to exchange messages from global client (parent frame) to hub client (iframe) and the other way around.
 *
 * Before sending and receiving messages is possible, the messagebox needs to be initialised from both sides (parent & hub) which will start a handshake session.
 * If this handshake is ready, the init call will give a Promise after which callbacks can be set for each MessageType.
 *
 * In the next timelime the handshake process is shown:
 *
 * - PARENT:    - Calls `messagebox.init( 'PARENT', 'https://urlofhub' )` which will:
 *              - Add an event listener for messages coming from the hub-client.
 *              - Waits for a 'handshake-start' message from the hub-client.
 *
 * - CHILD:     - Calls `messagebox.init( 'CHILD', 'https://global.pubhubs' )` which will:
 *              - Sends a 'handshake-start' message to the global-client.
 *              - Add an event listener for messages coming from the global client.
 *              - Waits for a 'handshake-ready' message from the global-client.
 *
 * - PARENT:    - Receives the 'handshake-start' message from the hub-client.
 *              - Sends a 'handshake-ready' message to the hub-client.
 *              - Sets internal state so received messages from the hub-client can be processed.
 *              - The `init()` call gives a Promise in which the global-client can set callbacks to certain messagetypes.
 *
 * - CHILD:     - Receices the 'handshake-ready' message from the global-client.
 *              - Sets internal state so received messages from the global-client hub can be processed.
 *              - The `init()` call gives a Promise in which the hub-client can set callbacks to certain messagetypes.
 *
 * Now both clients can send and receive messages to eachother.
 * After a message is received there are some tests done before processing the message:
 *
 * - Is the handshake ready?
 * - Is the message coming from the given url?
 * - Is the message of a known type?
 *
 * If everything is allright, the a callback will be searched for the received messagetype and if it is present, the callback will be called.
 *
 */

/**
 * The id of the iframe used to embed the hub's client.
 */
const iframeHubId = 'hub-frame-id';

/**
 * The id of the iframe used for the miniclients in the global bar.
 */
const miniClientId = 'miniclient-frame-id';

/**
 * Messagebox types
 */
enum MessageBoxType {
	Unset = '',
	Child = 'CHILD',
	Parent = 'PARENT',
}

/**
 * Message types
 */
const modalPrefix = 'dialog-modal';
enum MessageType {
	DialogShowModal = modalPrefix + '-show', // Show modal over bar,
	DialogHideModal = modalPrefix + '-hide', // Hide modal over bar

	Sync = 'sync', // CHILD asks for syncing settings etc.
	UnreadMessages = 'unreadmessages', // Sync total of unread messages for a hub
	SendHubInformation = 'sendhubinformation', // Let child ask to send the hubinformation
	HubInformation = 'hubinformation', // Sync hub information (name) with hub client.
	Settings = 'settings', // Sync settings
	RoomChange = 'roomchange', // Change to a room - makes it possible to reflect the room in the url
	AddAccessToken = 'addAccessToken', // Hub frame sends a access token for the global client to store in it's /bar/state.
	AddAuthInfo = 'addAuthInfo', // Hub frame sends its access token and userID to store it in the globalSettings object.
	RemoveAccessToken = 'removeAccessToken', // Hub frame sends a message to remove its' access token to the global client.
	BarShow = 'visibilityBar-show', // Show side bar, mostly relevant for mobile where it can be hidden.
	BarHide = 'visibilityBar-hide',
	EventChange = 'eventchange',
}

/**
 * A message is an object with:
 *
 *  - type - a MessageType. Only messages wit a known type can be send and received. Also a callback can be set to a certain message type.
 *  - content - can be anything
 */

type MessageContent = any;

class Message {
	type: MessageType;
	content: MessageContent;

	constructor(type: MessageType, content: MessageContent = '') {
		this.type = type;
		this.content = content;
	}
}

/**
 * Handshake state
 */
enum HandshakeState {
	Idle = 'idle',
	Started = 'started',
	Ready = 'ready',
}

/**
 * The messagebox itself
 */
const useMessageBox = defineStore('messagebox', {
	state: () => {
		return {
			inIframe: false, // Is the messagebox inside an iframe? Used to determine if a hub is on its own or inside an iframe of the global client.
			type: MessageBoxType.Unset, // Parent or Child
			receiverUrlMap: new Map<string, string>(), // The id of the iframe mapped to the url to which this messagebox can send and receive messages
			handshake: new Map<string, HandshakeState>(), // Handshake state
			callbacks: new Map<string, { [index in MessageType]: Function }>(), // List of callbacks per MessageType
			_windowMessageListener: new Map<string, any>(), // Event listener, set at init - (ts: a lot off overhead to replace any)
		};
	},

	getters: {
		/**
		 * Handshake is ready (true)
		 */
		isReady: (state) => {
			return (id: string): Boolean => {
				return state.handshake.get(id) === HandshakeState.Ready;
			};
		},

		/**
		 * If the hub-client is part of global-client (or standalone, in which case no messages are send/received)
		 */
		isConnected(state): Boolean {
			return state.type === MessageBoxType.Parent || state.inIframe;
		},
	},

	actions: {
		/**
		 * Initialize an empty messagebox for parent, hub and miniclients.
		 *
		 * @param type MessageBoxType (PARENT|CHILD)
		 */
		init(type: MessageBoxType) {
			this.reset();
			this.type = type;
		},

		/**
		 * The parent needs to perform a handshake with any of the child messageboxes (hub and miniclients),
		 * before communication can take place.
		 *
		 * @param url url of the other side
		 * @param [id='parentFrame'] the iframe id of the other side (the main frame does not have such an id, so the id will then be 'parentFrame')
		 *
		 * @returns a Promise after handshake is ready. Add callbacks after the promise is resolved.
		 */
		startCommunication(url: string, id: string = 'parentFrame'): Promise<boolean> {
			return new Promise((resolve, reject) => {
				this.receiverUrlMap.set(id, url);

				// If Child: start handshake with parent
				if (this.inIframe && this.type === MessageBoxType.Child) {
					this.sendMessage(new Message(MessageType.Sync), id);
					this.handshake.set(id, HandshakeState.Started);
				}

				// Start listening
				if (this.isConnected) {
					this._windowMessageListener.set(id, (event: MessageEvent) => {
						if (filters.removeTrailingSlash(event.origin) === filters.removeTrailingSlash(url)) {
							const message = new Message(event.data.type, event.data.content);

							const settings = useSettings();
							// Answer to handshake as parent
							if (message.type == MessageType.Sync && this.type === MessageBoxType.Parent) {
								// console.log('<= ' + this.type + ' RECEIVED handshake:', this.receiverUrl);
								this.sendMessage(
									new Message(MessageType.Settings, {
										// @ts-ignore
										theme: settings.theme as any,
										// @ts-ignore
										timeformat: settings.timeformat as any,
										// @ts-ignore
										language: settings.language,
									}),
									id,
								);

								this.handshake.set(id, HandshakeState.Ready);
								resolve(true);
							}

							// Answer to handshake as child
							else if (message.type == MessageType.Settings && this.type === MessageBoxType.Child) {
								// console.log('=> ' + this.type + ' RECEIVED', HandshakeState.Ready);

								settings.setTheme(message.content.theme as Theme);
								settings.setTimeFormat(message.content.timeformat as TimeFormat);
								settings.setLanguage(message.content.language);
								this.handshake.set(id, HandshakeState.Ready);
								resolve(true);
							}

							// Normal message was received and is of a known message type
							else if (Object.values(MessageType).includes(message.type)) {
								this.receivedMessage(message, id);
							}
						}
					});

					window.addEventListener('message', this._windowMessageListener.get(id));
				} else {
					reject();
				}
			});
		},

		/**
		 * Resets the messagebox. Messages can't be send or received anymore.
		 */
		reset() {
			this.receiverUrlMap.forEach((_, id) => window.removeEventListener('message', this._windowMessageListener.get(id)));
			this._windowMessageListener.clear();
			this.inIframe = window.self !== window.top;
			this.type = MessageBoxType.Unset;
			this.receiverUrlMap.clear();
			this.handshake.clear();
			this.callbacks.clear();
		},

		/**
		 * Resets the values for the hub that is currently opened in the iframe.
		 * Messages to and from this hub cannot be sent or received anymore, while messages to and from
		 * the miniclient iframes (for the pinned hubs in the global bar) can still be sent and received.
		 */
		resetCurrentHub() {
			window.removeEventListener('message', this._windowMessageListener.get(iframeHubId));
			this._windowMessageListener.delete(iframeHubId);
			this.receiverUrlMap.delete(iframeHubId);
			this.handshake.delete(iframeHubId);
			this.callbacks.delete(iframeHubId);
		},

		resetMiniclient(id: string) {
			const fullMiniclientId = miniClientId + '_' + id;
			window.removeEventListener('message', this._windowMessageListener.get(fullMiniclientId));
			this._windowMessageListener.delete(fullMiniclientId);
			this.receiverUrlMap.delete(fullMiniclientId);
			this.handshake.delete(fullMiniclientId);
			this.callbacks.delete(fullMiniclientId);
		},

		/**
		 * Depending on which client, resolve the target window.
		 * @param [id='parentFrame'] the id of the target window that needs to be resolved
		 * @ignore
		 */
		resolveTarget(id: string = 'parentFrame') {
			const target = {} as { [id: string]: { window: Window; receiverUrl: string } };
			if (this.type === MessageBoxType.Child) {
				const receiverUrl = this.receiverUrlMap.get(id);
				if (receiverUrl) {
					target[id] = { window: window.parent, receiverUrl };
				}
			} else if (id === 'parentFrame') {
				// If the id is 'parentFrame' and the messagebox is of type PARENT, the message needs to be sent to all receivers that are connected with the PARENT.
				this.receiverUrlMap.forEach((receiverUrl, idFromMap) => {
					const el: HTMLIFrameElement | null = document.querySelector('iframe#' + idFromMap);
					if (el !== null && el.contentWindow !== null && typeof el.contentWindow !== 'undefined') {
						target[idFromMap] = { window: el.contentWindow, receiverUrl };
					}
				});
			} else {
				const el: HTMLIFrameElement | null = document.querySelector('iframe#' + id);
				if (el !== null && el.contentWindow !== null && typeof el.contentWindow !== 'undefined') {
					const receiverUrl = this.receiverUrlMap.get(id);
					if (receiverUrl) {
						target[id] = { window: el.contentWindow, receiverUrl };
					}
				}
			}
			return target;
		},

		/**
		 * Send a message
		 *
		 * @param message Message
		 * @param [id='parentFrame'] the id of the target that the message needs to be sent to
		 */
		sendMessage(message: Message, id: string = 'parentFrame') {
			if (this.isConnected) {
				const target = this.resolveTarget(id);
				for (const id in target) {
					// console.log('=> ' + this.type + ' SEND', message, target[id].receiverUrl);
					target[id].window.postMessage(message, target[id].receiverUrl);
				}
			}
		},

		/**
		 * Called when a valid message is received
		 * It will call the callback that is set for the MessageType
		 *
		 * @param message Message
		 * @param id id of iframe that the message was received from
		 */
		receivedMessage(message: Message, id: string) {
			if (this.isReady(id)) {
				const callbacks = this.callbacks.get(id);
				const callback = callbacks ? callbacks[message.type] : undefined;
				// console.log('<= ' + this.type + ' RECEIVED', message, id, callback);
				if (callback) {
					callback(message as Message);
				}
			}
		},

		/**
		 * Add a callback to a given MessageType. The callback will be called after that MessageType has been received with the message.
		 *
		 * @param id id of the iframe that the callback belongs to
		 * @param type MessageType
		 * @param callback Function(message)
		 */
		addCallback(id: string, type: MessageType, callback: Function) {
			let callbacksList = this.callbacks.get(id);
			if (!callbacksList) callbacksList = {} as { [index in MessageType]: Function };
			callbacksList[type] = callback;
			this.callbacks.set(id, callbacksList);
		},

		/**
		 * Remove a callback
		 *
		 * @param id id of the iframe that the callback belongs to
		 * @param type MessageType
		 */
		removeCallback(id: string, type: MessageType) {
			let callbacksList = this.callbacks.get(id);
			if (!callbacksList) callbacksList = {} as { [index in MessageType]: Function };
			delete callbacksList[type];
			this.callbacks.set(id, callbacksList);
		},
	},
});

export { iframeHubId, miniClientId, Message, MessageBoxType, MessageType, useMessageBox };
