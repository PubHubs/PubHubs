async function delay(attempt: number): Promise<void> {
	const validAttempt = Math.max(attempt, 0);
	const delay = 100 * Math.min(Math.pow(2, validAttempt), 500); // 100, 200, 400, 500, 500 ...
	await new Promise((resolve) => setTimeout(resolve, delay));
}

export { delay };
