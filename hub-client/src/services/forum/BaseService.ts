import Room from '@/model/rooms/Room';
import { MatrixClient } from 'matrix-js-sdk';

export abstract class BaseForumService {
	protected client: MatrixClient;
	protected room: Room;

	constructor(client: MatrixClient, room: Room) {
		this.client = client;
		this.room = room;
	}
}
