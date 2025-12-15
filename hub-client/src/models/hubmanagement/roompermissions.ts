// The permission mechanism applied only to room-level roles and actions.
// Role for synapse admin doesn't need this permission because they don't have power level.
// This permission mechanism should not be used for synapse lever
import { actions, roles } from '@hub-client/models/constants';

const roleMappings = new Map();

// Invitation can be done by admin to super steward, super steward to steward.
roleMappings.set(actions.Invite, [roles.Admin, roles.SuperSteward]);
roleMappings.set(actions.AdminPanel, [roles.Admin]);
roleMappings.set(actions.StewardPanel, [roles.Steward]);
roleMappings.set(actions.MessageSteward, [roles.User, roles.Expert]);
roleMappings.set(actions.RoomAnnouncement, [roles.Admin]);

/**
 *
 * @param powerlevel power level can be 0 = user ,50= steward ,75= super steward ,100 = admin
 * @param action  see actions in constant for different actions that user can carry out depending on the role Map.
 * @returns
 */
function hasRoomPermission(powerlevel: number, action: actions) {
	if (powerlevel === undefined) {
		return false;
	}

	if (roleMappings.has(action)) {
		return roleMappings.get(action).includes(powerlevel);
	}
	return false;
}

export { hasRoomPermission };
