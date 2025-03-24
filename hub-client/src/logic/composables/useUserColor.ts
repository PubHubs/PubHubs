/**
 *
 * Colors for the users/avatars in a room.
 * TODO: for now just random, in the future a user should have own color
 *
 */

const textColors = ['text-accent-lime', 'text-accent-pink', 'text-accent-yellow', 'text-accent-red', 'text-accent-teal', 'text-accent-blue', 'text-accent-orange'];
const bgColors = ['bg-accent-lime', 'bg-accent-pink', 'bg-accent-yellow', 'bg-accent-red', 'bg-accent-teal', 'bg-accent-blue', 'bg-accent-orange'];

const useUserColor = () => {
	/**
	 * Get unique color index depending on userId
	 */
	const color = (userId: string) => {
		const maxColors = textColors.length;
		const intOfUserId = parseInt('0x' + userId.substring(1, 4), 16);
		return intOfUserId % maxColors;
	};

	const textColor = (number: number): string => {
		return textColors[number];
	};

	function bgColor(number: number): string {
		return bgColors[number];
	}

	return { color, textColor, bgColor };
};

export { useUserColor, textColors, bgColors };
