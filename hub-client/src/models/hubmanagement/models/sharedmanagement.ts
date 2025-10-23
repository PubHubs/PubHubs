// Models
import { IAccessListManagement } from '@hub-client/models/hubmanagement/interfaces/IAccessListManagement';

// All  functionality that is shared between different priveleged users i.e., Admin or Steward
export class SharedAccessManagement implements IAccessListManagement {
	addToAccessList(email: string): void {
		email;
	}
	removeFromAccessList(email: string): void {
		email;
	}
}
