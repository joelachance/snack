export interface KVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface Env {
	'SNACK-KV'?: KVNamespace;
	ENCRYPTION_KEY: string;
	[key: string]: string | KVNamespace | undefined;
}

export interface ConversationMessage {
	role: string;
	content: string;
}

export interface MCPServerConfig {
	url: URL;
	requestInit?: RequestInit;
	timeout?: number;
}
