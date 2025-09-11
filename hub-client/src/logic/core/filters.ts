import { LOGGER } from '@/logic/foundation/Logger.js';
import { SMI } from '@/logic/foundation/StatusMessage.js';
import { assert } from 'chai';

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

	getDateStr(date: string | string[] | Date | Date[], hour24: boolean, d: any, preview = false) {
		if (date instanceof Date || typeof date === 'string') {
			if (typeof date === 'string') {
				date = new Date(date);
			}
			const time = hour24 ? d(date, 'shorter') : d(date, 'shorter12Hour');
			return `${d(date, 'short')}, ${time}`;
		} else if (Array.isArray(date) && date.every((d, i, array) => d instanceof Date || typeof d === 'string' || (i === array.length - 1 && d === null))) {
			const startDate = new Date(date[0]);
			const startTime = hour24 ? d(startDate, 'shorter') : d(startDate, 'shorter12Hour');
			const endDate = date[1] ? new Date(date[1]) : null;
			let endTime: string | null = null;
			if (endDate) {
				endTime = hour24 ? d(endDate, 'shorter') : d(endDate, 'shorter12Hour');
			}
			if (endDate === null || startDate.toLocaleDateString() === endDate.toLocaleDateString()) {
				if (endTime && !preview) {
					return `${d(startDate, 'short')}, ${startTime} - ${endTime}`;
				} else if (endTime && preview) {
					return `${d(startDate, 'short')}, ${startTime} - ${d(endDate, 'short')}, ${endTime}`;
				} else {
					return `${d(startDate, 'short')}, ${startTime}`;
				}
			}
			return `${d(startDate, 'short')}, ${startTime} - ${d(endDate, 'short')}, ${endTime}`;
		} else {
			throw new Error('The date was not provided in one of the allowed types.');
		}
	},

	removeTrailingSlash(url: string) {
		assert.isString(url);
		return url.replace(/\/$/g, '');
	},

	maxLengthText(text: string, max: number = 20, ellipsis: string = '...') {
		assert.isString(text);
		assert.isNumber(max);
		assert.isString(ellipsis);
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
		assert.isString(matrixUserId);

		const parts = matrixUserId.split(':', 2);
		assert.equal(parts.length, 2, "matrix ID did not contain ':'");

		const [atLocalpart] = parts;
		assert.isAbove(atLocalpart.length, 0, "matrix ID did not start with '@'");
		assert.strictEqual(atLocalpart[0], '@', "matrix ID did not start with '@'");

		const localpart = atLocalpart.slice(1);

		const result: RegExpExecArray | null = shortenedPseudonymRegex.exec(localpart);

		if (!result || result.groups?.left.length !== result.groups?.right.length) {
			LOGGER.log(SMI.ERROR, `Matrix ID passed to extractPseudonym did not contain shortened pseudonym: ${matrixUserId}`);
			return '!!!-!!!';
		}

		return result[0];
	},

	// Extracts (first) shortened pseudonym from a string.
	extractPseudonymFromString(text: string) {
		assert.isString(text);
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
