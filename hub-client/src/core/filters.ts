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

	extractDisplayName(name: string) {
		const dashIndex = name.indexOf(' - ');
		let filteredName = name.substring(0, dashIndex + 1);

		if (filteredName.length < 1) {
			filteredName = 'Anonymous';
		}
		return filteredName;
	},

	formatBytes(bytes: number, decimals: number): string {
		if (bytes == 0) return '0 Bytes';
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
			i = Math.floor(Math.log(bytes) / Math.log(1024));
		return parseFloat((bytes / Math.pow(1024, i)).toFixed(decimals || 2)) + ' ' + sizes[i];
	},
};
