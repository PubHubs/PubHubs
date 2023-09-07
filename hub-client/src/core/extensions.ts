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

const createLinks = (text: string) => {
	const aTag = '<a target="_blank" class="text-green" ';
	// http://, https://, ftp://
	const urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#/%?=~_|!:,.;]*[a-z0-9-+&@#/%=~_|]/gim;
	// www. sans http:// or https://
	const pseudoUrlPattern = /(^|[^/])(www\.[\S]+(\b|$))/gim;
	// Email addresses
	const emailAddressPattern = /(([a-zA-Z0-9_\-.]+)@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6}))+/gim;
	return text
		.replace(urlPattern, aTag + 'href="$&">$&</a>')
		.replace(pseudoUrlPattern, '$1' + aTag + 'href="http://$2">$2</a>')
		.replace(emailAddressPattern, aTag + 'href="mailto:$1">$1</a>');
};

export { propCompare, trimSplit, createLinks };
