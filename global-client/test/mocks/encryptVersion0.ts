import PHCServer from '@global-client/models/MSS/PHC';

/*
This is the encryption with the version 0 encoding of the userSecret from before commit 4a22823 -> 2768b2a
We need to store this old function for testing if acounts made before 23 october on stable can still login and retreive their globalsettings,
after the merge from main to stable on 23 october
*/
export class EncryptVersion0 {
	static async encryptDataVersion0(data: Uint8Array, key: string) {
		const phcServer = new PHCServer();
		// Encode the key
		const encoder = new TextEncoder();
		const encodedKey = encoder.encode(key);
		// Generate random 256 bits (32 bytes) data
		const randomBits = crypto.getRandomValues(new Uint8Array(32));
		// Append the key to the random 256 bits
		// These random bits are generated and added before the encoded key to make sure that the key used to encrypt the data is different every time.
		// We need a different key every time, because there is a limit on how many times the encrypt function can be invoked with the same key when using RBG-based IV construction,
		// as written in section 8.3 of NIST Special Publication 800-38D (https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf).
		// Having a different key every time means that there is a negligible chance of using the same key with the same iv twice.
		// The IV could have been constructed of just random bits, but this would mean that we need to store an extra 32 bytes for every object to store the IV with the encrypted data.
		const derivedKey = phcServer['_concatUint8Arrays']([randomBits, encodedKey, encoder.encode('key')]);
		const derivedIV = phcServer['_concatUint8Arrays']([randomBits, encodedKey, encoder.encode('iv')]);
		// Calculate the SHA-256 hash of the concatenated random bits with the key to use as AES key and IV
		const aesKeyHash = await crypto.subtle.digest('SHA-256', derivedKey);
		const iv = await crypto.subtle.digest('SHA-256', derivedIV);
		// Import the key and use it to encrypt the data
		const aesKey = await crypto.subtle.importKey('raw', aesKeyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
		const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);
		// Prepend the random bits to the ciphertext
		const cipherText = phcServer['_concatUint8Arrays']([randomBits, new Uint8Array(encryptedData)]);
		return cipherText;
	}
}
