/**
 * A UUID v7 (RFC 9562): 48-bit Unix milliseconds, then random bits, so ids sort by creation time
 * and keep index locality (spec Q20 point 1). `crypto.randomUUID()` only makes v4.
 */
export function uuidV7(createdAtMs: number = Date.now()): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	let timestamp = createdAtMs;
	for (let i = 5; i >= 0; i--) {
		bytes[i] = timestamp % 256;
		timestamp = Math.floor(timestamp / 256);
	}
	bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
	bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
