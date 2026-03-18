function badgeSize(count: number): string {
	if (count >= 100) return 'lg';
	if (count >= 10) return 'md';
	return 'sm';
}

export { badgeSize };
