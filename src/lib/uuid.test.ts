import { describe, expect, it } from 'vitest';
import { uuidV7 } from './uuid';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV7', () => {
	it('is a lowercase RFC 9562 version 7 UUID', () => {
		expect(uuidV7()).toMatch(UUID_V7);
	});

	it('starts with the millisecond timestamp, so ids sort by creation time', () => {
		const createdAt = Date.UTC(2026, 9, 13, 14, 15, 0, 123);
		const id = uuidV7(createdAt);
		expect(parseInt(id.slice(0, 8) + id.slice(9, 13), 16)).toBe(createdAt);
		expect(uuidV7(createdAt + 1) > uuidV7(createdAt)).toBe(true);
	});

	it('differs within the same millisecond', () => {
		const createdAt = Date.now();
		const ids = new Set(Array.from({ length: 1000 }, () => uuidV7(createdAt)));
		expect(ids.size).toBe(1000);
	});
});
