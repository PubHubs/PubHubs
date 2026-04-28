// Models
import { type IAccessListManagement } from '@hub-client/models/hubmanagement/interfaces/IAccessListManagement';

// All  functionality that is shared between different priveleged users i.e., Admin or Steward
export class SharedAccessManagement implements IAccessListManagement {
	addToAccessList(_email: string): void {
		// Not yet implemented
	}
	removeFromAccessList(_email: string): void {
		// Not yet implemented
	}
}
