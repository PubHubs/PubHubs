/**
 * Gets the position of the caret in a text area.
 *
 * Adjusted from original.
 * @see https://codepen.io/erikmartinjordan/pen/gOgwJZZ;
 * @author Erik Martín Jordán
 */
export function getCaretPos(textArea: HTMLTextAreaElement) {
	const dummy = document.createElement('span');
	dummy.innerText = textArea.value;

	// Appending element to the DOM after textArea
	document.body.appendChild(dummy);

	// Getting the size of the rectangles inside dummy element
	const rectangles = dummy.getClientRects();
	const last = rectangles[rectangles.length - 1];

	// Getting coordinates of textArea
	const text = textArea.getBoundingClientRect();

	// Setting coordinates
	const x = text.x + last.width;
	const y = text.y + text.height - last.height;

	// Removing dummy
	dummy.remove();

	// Returning variables
	return {
		top: y,
		left: x,
	};
}
