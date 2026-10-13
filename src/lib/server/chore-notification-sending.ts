// Sends a new chore's Web Push notifications (spec Q11, Q20 point 3), after the chore is
// committed, through `waitUntil` from cloudflare:workers (src/routes/api/chores/+server.ts). The
// delivery itself is push-delivery.ts's.
import { deliverAndForgetExpired, vapidKeysFrom, type VapidEnv } from './push-delivery';
import { chooseChoreNotificationRecipients, formatChoreNotification } from './chore-notifications';
import { listActiveUsersPushSubscriptions } from './push-subscriptions';
import { listActiveUsers } from './users';

/** Spec Q11: one push per device of each recipient; never throws (it runs after the answer). */
export const sendChoreNotifications = async (
	db: D1Database,
	env: VapidEnv,
	choreId: string,
	now = new Date()
) => {
	try {
		const vapidKeys = vapidKeysFrom(env);
		if (!vapidKeys) return void console.error('VAPID keys missing: chore notifications not sent');
		const chore = await db
			.prepare(
				`SELECT c.performer_user_id, c.author_user_id, c.duration_minutes, c.started_at, t.short_label
				FROM chores c JOIN chore_types t ON t.id = c.chore_type_id WHERE c.id = ?`
			)
			.bind(choreId)
			.first<{
				performer_user_id: string;
				author_user_id: string;
				duration_minutes: number;
				started_at: string;
				short_label: string;
			}>();
		if (!chore) return;
		const activeUsers = await listActiveUsers(db);
		const findUser = (userId: string) => activeUsers.find((user) => user.id === userId);
		const performer = findUser(chore.performer_user_id);
		const author = findUser(chore.author_user_id);
		if (!performer || !author) return;
		const recipients = chooseChoreNotificationRecipients(
			{ performer, authorUserId: author.id },
			activeUsers
		);
		const subscriptions = await listActiveUsersPushSubscriptions(db);
		await Promise.all(
			recipients.flatMap((recipient) => {
				const payload = formatChoreNotification(
					{
						performer,
						author,
						shortLabel: chore.short_label,
						durationMinutes: chore.duration_minutes,
						startedAt: new Date(chore.started_at)
					},
					recipient,
					now
				);
				return subscriptions
					.filter((subscription) => subscription.userId === recipient.id)
					.map((subscription) => deliverAndForgetExpired(db, subscription, payload, vapidKeys));
			})
		);
	} catch (error) {
		console.error('Chore notifications not sent', String(error));
	}
};
