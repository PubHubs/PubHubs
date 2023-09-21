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
	if (trimmed == '') {
		return [];
	}
	const regex = new RegExp('\\s*' + delimiter + '\\s*');
	const result = trimmed.split(regex);
	return result;
};

const isEmpty = (v: any) => {
	if (typeof v == 'boolean') {
		return !v;
	}
	if (typeof v == 'string') {
		return v == '';
	}
	if (typeof v == 'object') {
		return Object.keys(v).length == 0;
	}
	return false;
};

export { propCompare, trimSplit, isEmpty };
