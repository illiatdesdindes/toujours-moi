import { describe, expect, it } from 'vitest';
import { defaultPerformerFor, listPerformerOptions } from './performer-choice';
import { allUsers, lea, maman, papa } from './test-users.fixtures';

describe('the home performer (spec Q3, Q8)', () => {
	it('is the selected person when the viewer may log for them, else the viewer', () => {
		expect(defaultPerformerFor(maman, { kind: 'person', person: lea })).toBe('lea');
		expect(defaultPerformerFor(maman, { kind: 'family' })).toBe('maman');
		// The admin may log for everyone, Maman included; Maman not for the admin.
		expect(defaultPerformerFor(papa, { kind: 'person', person: maman })).toBe('maman');
		expect(defaultPerformerFor(maman, { kind: 'person', person: papa })).toBe('maman');
	});

	it('is picked among those the viewer may log for', () => {
		expect(listPerformerOptions(papa, allUsers).map((user) => user.id)).toEqual([
			'papa',
			'maman',
			'lea',
			'noe'
		]);
		expect(listPerformerOptions(maman, allUsers).map((user) => user.id)).toEqual([
			'maman',
			'lea',
			'noe'
		]);
		expect(listPerformerOptions(lea, allUsers).map((user) => user.id)).toEqual(['lea']);
	});
});
