import CryptoJS from 'crypto-js';
import type { Env } from '../types';

/**
 * Encrypt API key using crypto-js library
 * @param text text to encrypt
 * @param env environment variables
 * @returns encrypted text
 */
export function encrypt(text: string, env: Env): string {
	const key = env.ENCRYPTION_KEY;

	if (!key) {
		throw new Error('ENCRYPTION_KEY is required');
	}

	return CryptoJS.AES.encrypt(text, key).toString();
}

/**
 * Decrypt API key using crypto-js library
 * @param encryptedText encrypted text to decrypt
 * @param env environment variables
 * @returns decrypted text
 */
export function decrypt(encryptedText: string, env: Env): string {
	const key = env.ENCRYPTION_KEY;

	if (!key) {
		throw new Error('ENCRYPTION_KEY is required');
	}

	const bytes = CryptoJS.AES.decrypt(encryptedText, key);
	return bytes.toString(CryptoJS.enc.Utf8);
}
