import { MatrixEvent } from 'matrix-js-sdk';

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

	extractJSONFromEventString(evt: MatrixEvent): string {
		const jsonStartIndex = evt.getContent().body.indexOf('{');
		const jsonEndIndex = evt.getContent().body.lastIndexOf('}');
		return evt.getContent().body.substring(jsonStartIndex, jsonEndIndex + 1);
	},
};