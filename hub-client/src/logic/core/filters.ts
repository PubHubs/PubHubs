// Regex describing the general shape of a shortened pseudonym
// Does not check the checkdigit, nor the fact that the left and right groups must be equally long.
// Only matches the whole string (does not search for a pseudonym in a larger string).
const shortenedPseudonymRegex = /^(?<left>[0-9a-f]{0,15}[0-9a-g])-(?<right>[0-9a-g][0-9a-f]{0,15})$/;
const shortenedPseudonymRegexString = /(?<left>[0-9a-f]{0,15}[0-9a-g])-(?<right>[0-9a-g][0-9a-f]{0,15})/;

export default {
	localeDateFromTimestamp(timestamp: number) {
		const date = new Date(timestamp);
		const now = new Date();

		// Today?
		if (now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth() && now.getDate() === date.getDate()) {
			return date.toLocaleTimeString();
		}

		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	},

	removeBackSlash(url: string) {
		return url.replace(/\/$/g, '');
	},

	maxLengthText(text: string, max: number = 20, ellipsis: string = '...') {
		if (text.length > max) {
			return text.substring(0, max) + ellipsis;
		}
		return text;
	},

	extractJSONFromEventString(name: string) {
		const jsonStartIndex = name.indexOf('{');
		const jsonEndIndex = name.lastIndexOf('}');
		return name.substring(jsonStartIndex, jsonEndIndex + 1);
	},

	// Extracts shortened pseudonym from matrix id.
	// Throws an error when the matrix ID is invalid in some way.
	// Return "!!!-!!!" if the matrix ID is valid, but the localpart is not a shortened pseudonym,
	// for example, when it's the matrix ID of some "notices" or "system" user.
	extractPseudonym(matrixUserId: string) {
		const parts = matrixUserId.split(':', 2);
		if (parts.length !== 2) {
			throw new Error("matrix ID did not contain ':'");
		}

		const [atLocalpart] = parts;
		if (atLocalpart.length === 0 || atLocalpart[0] !== '@') {
			throw new Error("matrix ID did not start with '@'");
		}

		const localpart = atLocalpart.slice(1);

		const result: RegExpExecArray | null = shortenedPseudonymRegex.exec(localpart);

		if (!result || result.groups?.left.length !== result.groups?.right.length) {
			console.error(`Matrix ID passed to extractPseudonym did not contain shortened pseudonym: ${matrixUserId}`);
			return '!!!-!!!';
		}

		return result[0];
	},

	// Extracts (first) shortened pseudonym from a string.
	extractPseudonymFromString(text: string) {
		const result: RegExpExecArray | null = shortenedPseudonymRegexString.exec(text);
		if (!result || result.groups?.left.length !== result.groups?.right.length) {
			return undefined;
		}
		return result[0];
	},

	formatBytes(bytes: number, decimals: number): string {
		if (bytes === 0) return '0 Bytes';
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
			i = Math.floor(Math.log(bytes) / Math.log(1024));
		return parseFloat((bytes / Math.pow(1024, i)).toFixed(decimals || 2)) + ' ' + sizes[i];
	},
};
