import CryptoJS from 'crypto-js';

export function encryptApiKey(plaintext: string, encryptionKey: string): string {
	if (!encryptionKey) {
		throw new Error('Encryption key is required');
	}
	return CryptoJS.AES.encrypt(plaintext, encryptionKey).toString();
}

export function decryptApiKey(encryptedData: string, encryptionKey: string): string {
	const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
	return bytes.toString(CryptoJS.enc.Utf8);
}
