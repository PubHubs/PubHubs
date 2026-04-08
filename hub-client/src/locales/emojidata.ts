// Packages
import { type Emoji } from 'emojibase';
import en from 'emojibase-data/en/data.json';
import nl from 'emojibase-data/nl/data.json';

const emojiData: Record<string, Emoji[]> = {
	en,
	nl,
	// Add more languages here as needed
};

export default emojiData;
