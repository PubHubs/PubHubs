/**
 * The handful of chai `assert` helpers this codebase actually uses.
 *
 * chai is a test library, and importing it from application code shipped ~115 KB of it in the
 * production bundle of both clients, on the startup path of each. These keep chai's names,
 * argument order, message-last convention and type narrowing, so call sites read the same.
 */

class AssertionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AssertionError';
	}
}

function fail(message: string | undefined, fallback: string): never {
	throw new AssertionError(message ?? fallback);
}

type Assert = {
	/** chai's bare `assert(expr, msg)`: throws unless the expression is truthy. */
	(expression: unknown, message?: string): asserts expression;
	isDefined<T>(value: T, message?: string): asserts value is Exclude<T, undefined>;
	isNotNull<T>(value: T, message?: string): asserts value is Exclude<T, null>;
	isTrue(value: unknown, message?: string): asserts value is true;
	isString<T>(value: T, message?: string): void;
	isNumber<T>(value: T, message?: string): void;
	isAbove(valueToCheck: number, valueToBeAbove: number, message?: string): void;
	strictEqual<T>(actual: T, expected: T, message?: string): void;
	equal(value1: unknown, value2: unknown, message?: string): void;
};

// Declared separately rather than as object-literal methods: TypeScript only honours an
// `asserts` signature when the callee's type is written out, and it does not infer one from a
// literal — the narrowing would silently disappear at every call site.
function assertTruthy(expression: unknown, message?: string): asserts expression {
	if (!expression) fail(message, 'expected expression to be truthy');
}

function isDefined<T>(value: T, message?: string): asserts value is Exclude<T, undefined> {
	if (value === undefined) fail(message, 'expected value to not be undefined');
}

function isNotNull<T>(value: T, message?: string): asserts value is Exclude<T, null> {
	if (value === null) fail(message, 'expected value to not be null');
}

function isTrue(value: unknown, message?: string): asserts value is true {
	if (value !== true) fail(message, `expected ${String(value)} to be true`);
}

function isString(value: unknown, message?: string): void {
	if (typeof value !== 'string') fail(message, `expected ${String(value)} to be a string`);
}

function isNumber(value: unknown, message?: string): void {
	if (typeof value !== 'number') fail(message, `expected ${String(value)} to be a number`);
}

function isAbove(valueToCheck: number, valueToBeAbove: number, message?: string): void {
	if (!(valueToCheck > valueToBeAbove)) fail(message, `expected ${valueToCheck} to be above ${valueToBeAbove}`);
}

function strictEqual<T>(actual: T, expected: T, message?: string): void {
	if (actual !== expected) fail(message, `expected ${String(actual)} to equal ${String(expected)}`);
}

function equal(value1: unknown, value2: unknown, message?: string): void {
	// chai's assert.equal is the loose comparison; assert.strictEqual is the strict one.
	// eslint-disable-next-line eqeqeq -- chai assert.equal is documented as the loose comparison; strictEqual is the strict one
	if (value1 != value2) fail(message, `expected ${String(value1)} to equal ${String(value2)}`);
}

const assert: Assert = Object.assign(assertTruthy, { isDefined, isNotNull, isTrue, isString, isNumber, isAbove, strictEqual, equal });

export { assert, AssertionError };
