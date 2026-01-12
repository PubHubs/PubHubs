class BlobManager {
	private _url: string | undefined;
	private _ownURL: boolean = false;
	private _isRevoked: boolean = true;

	constructor(input: Blob | MediaSource | string | undefined) {
		this.create(input);
	}

	create(input: Blob | MediaSource | string | undefined) {
		// clean up previous URL if necessary to cleanup memory
		this.revoke();

		//set new values
		if (input instanceof Blob || input instanceof MediaSource) {
			this._url = URL.createObjectURL(input);
			this._ownURL = true;
			this._isRevoked = false;
		} else if (typeof input === 'string' || input === undefined) {
			this._url = input;
			this._ownURL = false;
			this._isRevoked = false;
		} else {
			throw new Error('BlobManager: invalid input');
		}
	}

	get url() {
		return this._url;
	}

	revoke() {
		if (this._ownURL && !this._isRevoked && this._url) {
			URL.revokeObjectURL(this._url);
			this._url = undefined;
			this._ownURL = false;
			this._isRevoked = true;
		}
	}
}

export { BlobManager };
