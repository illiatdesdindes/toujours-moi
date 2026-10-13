import { describe, expect, it } from 'vitest';
import type { User } from '../domain';
import {
	chooseChoreNotificationRecipients,
	formatChoreNotification,
	type NotifiedChore
} from './chore-notifications';
import { allUsers, lea, maman, noe, papa } from './test-users.fixtures';

const secondParent: User = { id: 'tata', role: 'parent', name: 'Tata', colourKey: 'sage' };
const family = [...allUsers, secondParent];

const recipientNames = (performer: User, author: User) =>
	chooseChoreNotificationRecipients({ performer, authorUserId: author.id }, family).map(
		(recipient) => recipient.name
	);

describe('chooseChoreNotificationRecipients (spec Q11)', () => {
	it.each([
		// performer, author, notified
		[papa, papa, ['Maman', 'Tata']], // the admin's own: grown-ups, no child
		[maman, maman, ['Papa', 'Tata']], // a parent's own: grown-ups, no child
		[lea, lea, ['Papa', 'Maman', 'Noé', 'Tata']], // a child's own: grown-ups + the other child
		[lea, maman, ['Papa', 'Léa', 'Noé', 'Tata']], // logged for Léa: Léa too
		[maman, papa, ['Maman', 'Tata']], // logged for a parent: no child
		[noe, lea, ['Papa', 'Maman', 'Noé', 'Tata']] // impossible today (children log for themselves), still by the rule
	])('a chore by %o logged by %o notifies %o', (performer, author, expected) => {
		expect(recipientNames(performer, author)).toEqual(expected);
	});

	it('never notifies the author', () => {
		for (const performer of family)
			for (const author of family)
				expect(recipientNames(performer, author)).not.toContain(author.name);
	});
});

describe('formatChoreNotification (spec Q11)', () => {
	const now = new Date('2026-10-13T13:00:00Z'); // 15:00 in Paris
	const dishes = (performer: User, author: User): NotifiedChore => ({
		performer,
		author,
		shortLabel: 'Vaisselle',
		durationMinutes: 45,
		startedAt: new Date('2026-10-13T12:15:00Z')
	});

	it("says who did what, when, and opens Historique on the performer's profile", () => {
		expect(formatChoreNotification(dishes(lea, lea), papa, now)).toEqual({
			title: 'Léa · Vaisselle',
			body: "45 min · aujourd'hui, 14:15",
			tag: 'performer:lea',
			url: '/historique?profil=lea'
		});
	});

	it('tells the performer who logged it for them', () => {
		expect(formatChoreNotification(dishes(lea, papa), lea, now)).toEqual({
			title: 'Papa a noté pour toi',
			body: "Vaisselle · 45 min · aujourd'hui, 14:15",
			tag: 'performer:lea',
			url: '/historique'
		});
	});

	it('opens Famille when the recipient may not view the performer, their own Historique for a child', () => {
		expect(formatChoreNotification(dishes(papa, papa), maman, now).url).toBe(
			'/historique?profil=famille'
		);
		expect(formatChoreNotification(dishes(lea, lea), noe, now).url).toBe('/historique');
	});

	it('names an older day', () => {
		const yesterday = { ...dishes(lea, lea), startedAt: new Date('2026-10-12T18:00:00Z') };
		expect(formatChoreNotification(yesterday, papa, now).body).toBe('45 min · hier, 20:00');
	});
});
