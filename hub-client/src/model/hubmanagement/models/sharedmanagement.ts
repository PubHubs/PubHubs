/* All  functionality that is shared between different priveleged users i.e., Admin or Steward*/

import { IAccessListManagement } from '../interfaces/IAccessListManagement';
export class SharedAccessManagement implements IAccessListManagement {
	addToAccessList(email: string): void {
		email;
	}
	removeFromAccessList(email: string): void {
		email;
	}
}
