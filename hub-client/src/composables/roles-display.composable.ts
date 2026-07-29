// Packages
import { useI18n } from 'vue-i18n';

// Composables
import { RoleInvitationStatus, type RoleType } from '@hub-client/composables/manage-roles.composable';

/**
 * Shared display logic for role type and status labels/classes.
 * Used by RoleListCard and ManageRoleSidebar.
 */
const useRoleDisplay = () => {
	const { t } = useI18n();

	const getTypeLabel = (type: RoleType): string => {
		switch (type) {
			case 'steward-invitation':
				return t('roles.type_steward_invitation');
			case 'expert-invitation':
				return t('roles.type_expert_invitation');
			case 'active-steward':
				return t('roles.type_steward');
			case 'active-expert':
				return t('roles.type_expert');
			default:
				return '';
		}
	};

	const getTypeClasses = (type: RoleType): string => {
		switch (type) {
			case 'steward-invitation':
			case 'active-steward':
				return 'bg-accent-steward/20 text-accent-steward';
			case 'expert-invitation':
			case 'active-expert':
				return 'bg-accent-expert/20 text-accent-expert';
			default:
				return '';
		}
	};

	const getStatusLabel = (status: RoleInvitationStatus | undefined): string => {
		if (!status) return '';
		switch (status) {
			case RoleInvitationStatus.Disclosed:
				return t('roles.status_disclosed');
			case RoleInvitationStatus.Pending:
				return t('roles.status_pending');
			default:
				return '';
		}
	};

	const getStatusClasses = (status: RoleInvitationStatus | undefined): string => {
		if (!status) return '';
		switch (status) {
			case RoleInvitationStatus.Disclosed:
				return 'bg-success/20 text-success';
			case RoleInvitationStatus.Pending:
				return 'bg-warning/20 text-warning';
			default:
				return '';
		}
	};

	return {
		getTypeLabel,
		getTypeClasses,
		getStatusLabel,
		getStatusClasses,
	};
};

export { useRoleDisplay };
