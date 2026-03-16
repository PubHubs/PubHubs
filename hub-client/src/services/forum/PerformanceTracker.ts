export class PerformanceTracker {
	private static instances: Map<string, PerformanceTracker> = new Map();
	private startTime: number | null = null;
	private measurements: { name: string; duration: number }[] = [];

	public static getTracker(id: string): PerformanceTracker {
		if (!this.instances.has(id)) {
			this.instances.set(id, new PerformanceTracker());
		}
		return this.instances.get(id)!;
	}

	public start(): this {
		this.startTime = performance.now();
		return this;
	}

	public mark(name: string): this {
		if (this.startTime === null) {
			console.warn('Performance tracker marked without starting first');
			return this;
		}

		const duration = performance.now() - this.startTime;
		this.measurements.push({ name, duration });
		return this;
	}

	// public end(name: string = 'total'): number {
	// 	if (this.startTime === null) {
	// 		console.warn('Performance tracker ended without starting first');
	// 		return 0;
	// 	}
	//
	// 	const duration = performance.now() - this.startTime;
	// 	this.measurements.push({ name, duration });
	// 	this.startTime = null;
	// 	return duration;
	// }

	public end(prefix: string = ''): this {
		const logPrefix = prefix ? `${prefix}: ` : '';

		console.group(`${logPrefix}Performance Measurements`);
		this.measurements.forEach(({ name, duration }) => {
			console.log(`${name}: ${duration.toFixed(2)}ms`);
		});
		console.groupEnd();
		this.measurements = [];
		return this;
	}

	// public static async measure<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
	// 	const start = performance.now();
	// 	const result = await fn();
	// 	const duration = performance.now() - start;
	// 	console.log(`${name} completed in ${duration.toFixed(2)}ms`);
	// 	return result;
	// }
}
