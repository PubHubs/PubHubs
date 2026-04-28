export type ContextMenuItemProps = {
	ariaLabel?: string;
	disabled?: boolean;
	icon?: string;
	variant?: ContextVariant;
	label: string;
	title?: string;
};

export type MenuItem = ContextMenuItemProps & {
	onClick?: () => void;
	payload?: unknown;
	divider?: boolean;
	isDelicate?: boolean;
};

export enum ContextVariant {
	delicate = 'text-button-red',
	yellow = 'text-accent-yellow',
}
