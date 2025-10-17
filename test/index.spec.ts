import { describe, it, expect } from 'vitest';
import { encryptApiKey, decryptApiKey } from '../api/utils/crypto';

describe('Snack API', () => {
	it('should have basic test setup', () => {
		expect(true).toBe(true);
	});

	it('should validate test environment', () => {
		expect(typeof describe).toBe('function');
		expect(typeof it).toBe('function');
		expect(typeof expect).toBe('function');
	});

	it('should encrypt and decrypt API keys', () => {
		const apiKey = 'test-api-key-123';
		const encryptionKey = 'test-encryption-key';

		const encrypted = encryptApiKey(apiKey, encryptionKey);
		expect(encrypted).toBeDefined();
		expect(encrypted).not.toBe(apiKey);

		const decrypted = decryptApiKey(encrypted, encryptionKey);
		expect(decrypted).toBe(apiKey);
	});
});
