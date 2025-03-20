import { ISuspendUser } from '../interfaces/ISuspendUser';
import { SharedAccessManagement } from './sharedmanagement';

/* Administrator can create, delete, update room. Administrator can also change permissions.  */

export class Steward implements ISuspendUser {
	private accessListManager: SharedAccessManagement;

	constructor() {
		this.accessListManager = new SharedAccessManagement();
	}

	banUser(userId: string): void {
		/*  */
	}

	kickUser(userId: string): void {
		/* */
	}
}
