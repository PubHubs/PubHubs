class ElementObserver {
	private observer: IntersectionObserver | null = null;
	private elements: HTMLElement[] = [];

	// Can be optional
	// https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver#options
	// https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API#threshold
	// Better to keep threshold default value of 0 of the API instead of supplying our default value.
	private options?: IntersectionObserverInit;

	constructor(elements: HTMLElement[], options?: IntersectionObserverInit) {
		this.elements = elements;
		this.options = options;
	}

	setUpObserver(callback: IntersectionObserverCallback) {
		if (!this.elements.length) {
			return; // do NOT throw an error, that stops further execution
			//throw new Error('Element ${element} is not found');
		}

		this.observer = new IntersectionObserver((entries, observer) => {
			// Only look for visible elements on the viewport - if isIntersecting is true.
			const intersectingEntries = entries.filter((entry) => entry.isIntersecting);
			callback(intersectingEntries, observer);
		}, this.options);

		for (const element of this.elements) {
			this.observer.observe(element);
		}
	}

	disconnectObserver() {
		this.observer?.disconnect();
	}
}

export { ElementObserver };
