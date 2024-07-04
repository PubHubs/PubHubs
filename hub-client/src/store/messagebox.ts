import { defineStore } from 'pinia';
import filters from '@/core/filters';

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
const handShakePrefix = 'handshake';
const modalPrefix = 'dialog-modal';
enum MessageType {
	HandshakeStart = handShakePrefix + '-start', // Start the handshake
	HandshakeReady = handShakePrefix + '-ready', // Handshake is ready

	DialogShowModal = modalPrefix + '-show', // Show modal over bar
	DialogHideModal = modalPrefix + '-hide', // Hide modal over bar

	Sync = 'sync', // CHILD asks for syncing settings etc.
	UnreadMessages = 'unreadmessages', // Sync total of unread messages for a hub
	Settings = 'settings', // Sync settings
	RoomChange = 'roomchange', // Change to a room - makes it possible to reflect the room in the url
	AddAccessToken = 'addAccessToken', // Hub frame sends a access token for the global client to store in it's localstorage.
	RemoveAccessToken = 'removeAccessToken', // Hub frame sends a message to remove its' access to token to the global client.
	mobileHubMenu = 'mobilehubmenu', // Keeps track of wether to show the mobile global hubbar
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
		if (this.isHandShakeMessage()) {
			this.content = type;
		} else {
			this.content = content;
		}
	}

	isHandShakeStart() {
		return this.type === MessageType.HandshakeStart;
	}

	isHandShakeReady() {
		return this.type === MessageType.HandshakeReady;
	}

	isHandShakeMessage() {
		const type = this.type;
		if (typeof type === 'string') {
			return type.substring(0, handShakePrefix.length) === handShakePrefix;
		}
		return false;
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
			receiverUrl: '' as string, // The url to which this messagebox can send and receive messages
			handshake: HandshakeState.Idle, // Handshake state
			callbacks: {} as { [index in MessageType]: Function }, // List of callbacks per MessageType
			_windowMessageListener: {} as any, // Event listener, set at init - (ts: a lot off overhead to replace any)
		};
	},

	getters: {
		/**
		 * Handshake is ready (true)
		 */
		isReady(state): Boolean {
			return state.handshake === HandshakeState.Ready;
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
		 * Both parent and hub needs to be initialised.
		 *
		 * @param type MessageBoxType (PARENT|CHILD)
		 * @param url url of the other side
		 *
		 * @returns a Promise after handshake is ready. Add callbacks after the promise is resolved.
		 */
		init(type: MessageBoxType, url: string): Promise<boolean> {
			return new Promise((resolve, reject) => {
				this.reset();
				this.type = type;
				this.receiverUrl = url;

				// If Child: start handshake with parent
				if (this.inIframe && this.type === MessageBoxType.Child) {
					this.sendMessage(new Message(MessageType.HandshakeStart));
					this.handshake = HandshakeState.Started;
				}

				// Start listening
				if (this.isConnected) {
					this._windowMessageListener = (event: MessageEvent) => {
						// Allways test if message is from expected domain
						if (filters.removeBackSlash(event.origin) === filters.removeBackSlash(this.receiverUrl)) {
							const message = new Message(event.data.type, event.data.content);

							// Answer to handshake as parent
							if (message.isHandShakeStart() && type === MessageBoxType.Parent) {
								// console.log('<= ' + this.type + ' RECEIVED handshake:', this.receiverUrl);
								this.sendMessage(new Message(MessageType.HandshakeReady));
								this.handshake = HandshakeState.Ready;
								resolve(true);
							}

							// Answer to handshake as child
							else if (message.isHandShakeReady() && type === MessageBoxType.Child) {
								// console.log('=> ' + this.type + ' RECEIVED', HandshakeState.Ready);
								this.handshake = HandshakeState.Ready;
								resolve(true);
							}

							// Normal message was received and is of a known message type
							else if (Object.values(MessageType).includes(message.type)) {
								this.receivedMessage(message);
								reject();
							}
						}
					};

					window.addEventListener('message', this._windowMessageListener);
				} else {
					reject();
				}
			});
		},

		/**
		 * Resets the messagebox. Messages can't be send or received anymore.
		 */
		reset() {
			window.removeEventListener('message', this._windowMessageListener);
			this.inIframe = window.self !== window.top;
			this.type = MessageBoxType.Unset;
			this.receiverUrl = '';
			this.handshake = HandshakeState.Idle;
			this.callbacks = {} as { [index in MessageType]: Function };
		},

		/**
		 * Depending on which client, resolve the target window.
		 * @ignore
		 */
		resolveTarget() {
			let target = null;
			if (this.type === MessageBoxType.Child) {
				target = window.parent;
			} else {
				const el: HTMLIFrameElement | null = document.querySelector('iframe#' + iframeHubId);
				if (el !== null && typeof el.contentWindow !== 'undefined') {
					target = el ? el.contentWindow : null;
				}
			}
			return target;
		},

		/**
		 * Send a message
		 *
		 * @param message Message
		 */
		sendMessage(message: Message) {
			if (this.isConnected) {
				const target = this.resolveTarget();
				if (target) {
					// console.log('=> ' + this.type + ' SEND', message, this.receiverUrl);
					target.postMessage(message, this.receiverUrl);
				}
			}
		},

		/**
		 * Called when a valid message is received
		 * It will call the callback that is set for the MessageType
		 *
		 * @param message Message
		 */
		receivedMessage(message: Message) {
			if (this.handshake === HandshakeState.Ready) {
				const callback = this.callbacks[message.type];
				// console.log('<= ' + this.type + ' RECEIVED', message, callback);
				if (callback) {
					callback(message as Message);
				}
			}
		},

		/**
		 * Add a callback to a given MessageType. The callback will be called after that MessageType has been received with the message.
		 *
		 * @param type MessageType
		 * @param callback Function(message)
		 */
		addCallback(type: MessageType, callback: Function) {
			this.callbacks[type] = callback;
		},

		/**
		 * Remove a callback
		 *
		 * @param type MessageType
		 */
		removeCallback(type: MessageType) {
			delete this.callbacks[type];
		},
	},
});

export { iframeHubId, MessageType, Message, MessageBoxType, useMessageBox };
