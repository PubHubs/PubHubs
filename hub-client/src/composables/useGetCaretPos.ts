/**
 * Gets the position of the caret in a text area.
 *
 * Adjusted from original.
 * @see https://codepen.io/erikmartinjordan/pen/gOgwJZZ;
 * @author Erik Martín Jordán
 */

const useGetCaretPos = () => {
	const getCaretPos = (textArea: HTMLTextAreaElement) => {
		const dummy = document.createElement('div');

		// Copy textarea styles so text wraps the same way
		const styles = window.getComputedStyle(textArea);
		dummy.style.position = 'absolute';
		dummy.style.visibility = 'hidden';
		dummy.style.whiteSpace = 'pre-wrap';
		dummy.style.wordWrap = 'break-word';
		dummy.style.width = styles.width;
		dummy.style.font = styles.font;
		dummy.style.padding = styles.padding;
		dummy.style.border = styles.border;
		dummy.style.boxSizing = styles.boxSizing;

		// Get text up to cursor position and add a marker span
		const cursorPos = textArea.selectionStart;
		const textBeforeCursor = textArea.value.substring(0, cursorPos);
		const marker = document.createElement('span');
		marker.innerText = '\u200B'; // Zero-width space as marker

		dummy.innerText = textBeforeCursor;
		dummy.appendChild(marker);

		// Appending element to the DOM
		document.body.appendChild(dummy);

		// Getting coordinates of textArea and marker
		const textRect = textArea.getBoundingClientRect();
		const markerRect = marker.getBoundingClientRect();
		const dummyRect = dummy.getBoundingClientRect();

		// Calculate position relative to textarea
		const x = textRect.x + (markerRect.left - dummyRect.left);
		const y = textRect.y + (markerRect.top - dummyRect.top) + markerRect.height;

		// Removing dummy
		dummy.remove();

		// Returning variables
		return {
			top: y,
			left: x,
		};
	};

	return { getCaretPos };
};

export { useGetCaretPos };
