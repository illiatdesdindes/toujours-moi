// Who hears about a new chore, and what their phone says (spec Q11). Pure: the sending is
// chore-notification-sending.ts's.
import { formatDuration } from '../chore-timing';
import type { PersonRef, PushNotificationPayload, SelectedProfile, User } from '../domain';
import { formatParisDayAndTime } from '../paris-time';
import { canViewFamilyProfile, canViewProfile } from './access-policy';
import { profileParamFor } from './profile-selection';

/** A just-created chore, as its notifications tell it. */
export type NotifiedChore = {
	performer: User;
	author: User;
	shortLabel: string;
	durationMinutes: number;
	startedAt: Date;
};

/**
 * Spec Q11: never the author; every grown-up (admin, parents); a child when they're the performer
 * (logged for them) or the performer is another child, not for a grown-up's chore.
 */
export const chooseChoreNotificationRecipients = <Recipient extends PersonRef>(
	chore: { performer: PersonRef; authorUserId: string },
	activeUsers: Recipient[]
) =>
	activeUsers.filter(
		(recipient) =>
			recipient.id !== chore.authorUserId &&
			(recipient.role !== 'child' ||
				recipient.id === chore.performer.id ||
				chore.performer.role === 'child')
	);

/** Title "Léa · Vaisselle", or "Papa a noté pour toi" for the performer; tap → Historique on the performer. */
export const formatChoreNotification = (
	chore: NotifiedChore,
	recipient: User,
	now: Date
): PushNotificationPayload => {
	const durationAndDay = `${formatDuration(chore.durationMinutes)} · ${formatParisDayAndTime(chore.startedAt, now)}`;
	const isLoggedForRecipient = recipient.id === chore.performer.id;
	return {
		title: isLoggedForRecipient
			? `${chore.author.name} a noté pour toi`
			: `${chore.performer.name} · ${chore.shortLabel}`,
		body: isLoggedForRecipient ? `${chore.shortLabel} · ${durationAndDay}` : durationAndDay,
		// One per performer: a performer's pushes replace one another in the tray.
		tag: `performer:${chore.performer.id}`,
		url: historiqueUrlFor(recipient, chore.performer)
	};
};

/** The performer's profile when the recipient may view it, else Famille (a parent, the other parent's chore), else their own (a child). */
const historiqueUrlFor = (recipient: User, performer: User) => {
	const profile: SelectedProfile = canViewProfile(recipient, performer)
		? { kind: 'person', person: performer }
		: canViewFamilyProfile(recipient)
			? { kind: 'family' }
			: { kind: 'person', person: recipient };
	const profileParam = profileParamFor(recipient, profile);
	return profileParam ? `/historique?profil=${profileParam}` : '/historique';
};
