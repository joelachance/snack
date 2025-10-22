/**
 * @fileoverview Slack Payload Processing Utilities
 * 
 * This module contains utility functions for processing incoming Slack payloads.
 * The parseSlackPayload function is essential for all Slack event processing, handling
 * both URL-encoded payloads (modal submissions) and JSON payloads (regular events).
 * The handleUrlVerification function is specifically for Slack's one-time URL
 * verification challenge during app installation/configuration.
 * 
 * @author Snack Worker
 * @since 1.0.0
 */

/**
 * Parse Slack payload from request body
 * 
 * Essential function for processing all incoming Slack webhook data. Handles both 
 * URL-encoded payloads (for modal submissions) and JSON payloads (for regular events).
 * This function is used for ALL Slack event processing, not just verification.
 * 
 * @param {string} rawBody - Raw request body from Slack
 * @returns {object|null} Parsed payload object or null if parsing fails
 * 
 * @example
 * // URL-encoded payload (modal submissions)
 * const payload = parseSlackPayload('payload=%7B%22type%22%3A%22view_submission%22%7D');
 * 
 * // JSON payload (regular events)
 * const payload = parseSlackPayload('{"type":"url_verification","challenge":"abc123"}');
 */
export function parseSlackPayload(rawBody) {
	if (!rawBody) return null;

	// Handle URL-encoded payload (for modal submissions)
	if (rawBody.startsWith('payload=')) {
		try {
			const decodedPayload = decodeURIComponent(rawBody.substring(8));
			return JSON.parse(decodedPayload);
		} catch (error) {
			console.error('Error parsing URL-encoded payload:', error);
			return null;
		}
	}

	// Handle JSON payload (for regular events)
	try {
		return JSON.parse(rawBody);
	} catch (error) {
		console.error('Error parsing JSON payload:', error);
		return null;
	}
}

/**
 * Handle Slack URL verification challenge
 * 
 * Responds to Slack's URL verification challenge which is sent during app
 * installation/configuration. This is a one-time verification step that
 * confirms the app endpoint is legitimate and can receive Slack events.
 * 
 * @param {object} payload - Parsed payload from Slack
 * @returns {Response|null} Challenge response or null if not a verification request
 * 
 * @example
 * const payload = { type: 'url_verification', challenge: 'abc123' };
 * const response = handleUrlVerification(payload);
 * // Returns: Response with 'abc123' as body and 200 status
 */
export function handleUrlVerification(payload) {
	if (payload?.type === 'url_verification') {
		return new Response(payload.challenge, {
			status: 200,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
	return null;
}
