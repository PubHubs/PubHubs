export default {
	matrixDisplayName(name: string) {
		return name.replace(/^@(.*):.*/g, '$1');
	},

	localeDateFromTimestamp(timestamp: number) {
		const date = new Date(timestamp);
		const now = new Date();

		// Today?
		if (now.getFullYear() == date.getFullYear() && now.getMonth() == date.getMonth() && now.getDate() == date.getDate()) {
			return date.toLocaleTimeString();
		}

		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	},

	removeBackSlash(url: string) {
		return url.replace(/\/$/g, '');
	},

	extractJSONFromEventString(name: string) {
		const jsonStartIndex = name.indexOf('{');
		const jsonEndIndex = name.lastIndexOf('}');
		return name.substring(jsonStartIndex, jsonEndIndex + 1);
	},

	extractPseudonym(displayName: string) {
		const pattern = /[a-zA-Z0-9]{3}-[a-zA-Z0-9]{3}/;
		const result = displayName.match(pattern);
		return result ? result[0] : ''; // result[0] will contain the matched string
	},
};
