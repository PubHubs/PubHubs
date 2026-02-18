export type ContextMenuItemProps = {
	ariaLabel?: string;
	disabled?: boolean;
	icon?: string;
	isDelicate?: boolean;
	label: string;
	title?: string;
};

export type MenuItem = ContextMenuItemProps & {
	onClick?: () => void;
	payload?: any;
};
