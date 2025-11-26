//
// https://dev.to/devsmitra/maximizing-performance-how-to-memoize-async-functions-in-javascript-4on8
//
// COMMENTS FOR IMPROVEMENT, see: https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/merge_requests/574
//
const memoize = (fn: any) => {
	const cache = new Map();
	return (arg: any) => {
		if (!cache.has(arg)) {
			const val = fn(arg);
			if (val instanceof Promise) {
				cache.set(
					arg,
					val.catch((reason) => {
						cache.delete(arg);
						throw reason;
					}),
				);
			} else {
				cache.set(arg, val);
			}
		}
		return cache.get(arg);
	};
};

const propCompare = (prop: string) => {
	return (a: any, b: any) => {
		if (a[prop] && b[prop]) {
			return Number(a[prop] > b[prop]);
		}
		return 0;
	};
};

const trimSplit = (list: string, delimiter: string = ',') => {
	const trimmed = list.replace(/\s/g, '').replace(/,+/g, ',');
	if (trimmed === '') {
		return [];
	}
	const regex = new RegExp('\\s*' + delimiter + '\\s*');
	const result = trimmed.split(regex);
	return result;
};

const isEmpty = (v: any) => {
	if (typeof v === 'boolean') {
		return !v;
	}
	if (typeof v === 'string') {
		return v === '';
	}
	if (typeof v === 'object') {
		return Object.keys(v).length === 0;
	}
	return false;
};

// Check if given object is an object and not an array.
const isObject = (item: any): item is Object => {
	return item && typeof item === 'object' && !Array.isArray(item);
};

const mergeDeep = (target: any, ...sources: any): any => {
	if (!sources.length) return target;
	const source = sources.shift();

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key])
					Object.assign(target, {
						[key]: {},
					});
				mergeDeep(target[key], source[key]);
			} else {
				Object.assign(target, {
					[key]: source[key],
				});
			}
		}
	}

	return mergeDeep(target, ...sources);
};

const filterAlphanumeric = (text: string): string => {
	// Regex pattern for non-alphanumeric characters
	const pattern = /[^a-zA-Z0-9\s]/g;
	return text.replace(pattern, ' ').trim();
};

const firstToUpper = (text:string) : string => {
	return text[0].toUpperCase() + text.substring(1);
}

export { memoize, propCompare, trimSplit, isEmpty, isObject, mergeDeep, filterAlphanumeric, firstToUpper };
