import { type MatrixClient } from 'matrix-js-sdk';

import type Room from '@hub-client/models/rooms/Room';

export abstract class BaseForumService {
	protected client: MatrixClient;
	protected room: Room;

	constructor(client: MatrixClient, room: Room) {
		this.client = client;
		this.room = room;
	}
}
