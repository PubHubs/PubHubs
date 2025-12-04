class ElementObserver {
	private observer: IntersectionObserver | null = null;
	private element: HTMLElement | null = null;

	// Can be optional
	// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver#options
	// https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API#threshold
	// Better to keep threshold default value of 0 of the API instead of supplying our default value.
	private options?: IntersectionObserverInit;

	constructor(element: HTMLElement, options?: IntersectionObserverInit) {
		this.element = element;
		this.options = options;
	}

	setUpObserver(callback: IntersectionObserverCallback) {
		if (!this.element) {
			return; // do NOT throw an error, that stops further execution
			//throw new Error('Element ${element} is not found');
		}

		this.observer = new IntersectionObserver((entries, observer) => {
			// Only look for visible elements on the viewport - if isIntersecting is true.
			const intersectingEntries = entries.filter((entry) => entry.isIntersecting);
			callback(intersectingEntries, observer);
		}, this.options);

		for (const value of Object.values(this.element)) {
			this.observer.observe(value);
		}
	}

	disconnectObserver() {
		this.observer?.disconnect();
	}
}

export { ElementObserver };
