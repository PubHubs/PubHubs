enum SortOrder {
	asc = 1,
	desc = -1,
}

interface SortOption {
	index: number;
	order: SortOrder;
}

export { SortOrder, SortOption };
