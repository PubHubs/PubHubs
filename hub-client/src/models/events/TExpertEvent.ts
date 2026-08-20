/**
 * Base type for Matrix account data content.
 * Compatible with Matrix SDK's IContent interface.
 */
type AccountDataContent = Record<string, unknown>;

/**
 * Expert profile content - stored in Matrix account data (global, user-controlled).
 * Event type: "pubhubs.expert_profile"
 */
type TExpertProfileContent = AccountDataContent & {
	credentials: string; // e.g., "Licensed physician since 2010"
	specializations?: string[]; // e.g., ["Internal Medicine", "Cardiology"]
	institution?: string; // e.g., "Amsterdam UMC"
};

/**
 * Type of expert assessment on a message.
 */
type TExpertVerificationType = 'verified' | 'falsified' | 'context';

/**
 * Expert verification message content - sent as a related message to mark a message as verified/falsified.
 * Uses m.relates_to to link to the target message.
 */
type TExpertVerificationMessageContent = {
	msgtype: 'pubhubs.expert_verification';
	body: string;
	verification_type: TExpertVerificationType;
	credentials: string;
	specializations?: string[];
	verification_note?: string;
	sources?: string[];
	'm.relates_to': {
		rel_type: 'pubhubs.expert_verify' | 'pubhubs.expert_unverify';
		event_id: string;
	};
};

// Extend Matrix SDK's AccountDataEvents to include custom PubHubs event types
declare module 'matrix-js-sdk' {
	interface AccountDataEvents {
		'pubhubs.expert_profile': TExpertProfileContent;
	}
}

export { TExpertProfileContent, TExpertVerificationMessageContent, TExpertVerificationType };
