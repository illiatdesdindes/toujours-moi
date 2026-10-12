import { describe, expect, it } from 'vitest';
import { isUuidV7, uuidV7 } from './uuid';

describe('uuidV7', () => {
	it('is a lowercase RFC 9562 version 7 UUID', () => {
		expect(isUuidV7(uuidV7())).toBe(true);
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

describe('isUuidV7', () => {
	it('accepts only lowercase version 7 UUIDs', () => {
		expect(isUuidV7('0199e1c2-3b4a-7c5d-8e6f-0123456789ab')).toBe(true);
		expect(isUuidV7('0199E1C2-3B4A-7C5D-8E6F-0123456789AB')).toBe(false);
		expect(isUuidV7(crypto.randomUUID())).toBe(false); // v4
		expect(isUuidV7('0199e1c2-3b4a-7c5d-0e6f-0123456789ab')).toBe(false); // variant
		expect(isUuidV7("1' OR 1=1")).toBe(false);
		expect(isUuidV7(42)).toBe(false);
	});
});
