//This is a prototype version to have authenticated downloads for the room library.
const fileDownload = async (accessToken: string | null, url: string): Promise<string | null> => {
	const options = {
		headers: {
			Authorization: 'Bearer ' + accessToken,
		},
		method: 'GET',
	};
	try {
		const response = await fetch(url, options);

		const blob = await response.blob();
		if (blob != null) {
			const fileURL = window.URL.createObjectURL(blob);
			return fileURL;
		}
		return null;
	} catch (error) {
		console.error('Error downloading the file: ', error);
		return null;
	}
};

export { fileDownload };
