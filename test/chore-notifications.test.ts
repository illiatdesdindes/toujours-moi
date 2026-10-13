// Spec Q11, Q20 point 3: a new chore's Web Push notifications, against a fake push service.
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidV7 } from '../src/lib/uuid';
import {
	ADMIN_ID,
	CHILD_ID,
	PARENT_ID,
	SECOND_CHILD_ID,
	resetFamily,
	seedFamily
} from './test-family';
import {
	accessHeaders,
	postFormAction,
	postJson,
	sendJson,
	stubOutboundFetch
} from './worker-requests';

const DISHES_ID = '01900000-0000-7000-a000-000000000001';
const HOUR_MS = 3_600_000;
const EMAIL_OF = {
	[ADMIN_ID]: 'papa@exemple.fr',
	[PARENT_ID]: 'maman@exemple.fr',
	[CHILD_ID]: 'lea@exemple.fr',
	[SECOND_CHILD_ID]: 'noe@exemple.fr'
};
type FamilyUserId = keyof typeof EMAIL_OF;
/** One phone per person. */
const PHONE_OF = {
	[ADMIN_ID]: 'https://push.example/papa-phone',
	[PARENT_ID]: 'https://push.example/maman-phone',
	[CHILD_ID]: 'https://push.example/lea-phone',
	[SECOND_CHILD_ID]: 'https://push.example/noe-phone'
};

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

/** A device's `PushSubscription.toJSON()`, with real keys: the payload is encrypted for it. */
const deviceSubscription = async (endpoint: string) => {
	const keyPair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	])) as CryptoKeyPair;
	return {
		endpoint,
		keys: {
			p256dh: b64url((await crypto.subtle.exportKey('raw', keyPair.publicKey)) as ArrayBuffer),
			auth: b64url(crypto.getRandomValues(new Uint8Array(16)))
		}
	};
};

/** Réglages' toggle turned on, on `endpoint`, by `userId`. */
const subscribeDevice = async (userId: FamilyUserId, endpoint = PHONE_OF[userId]) =>
	postJson(
		'/reglages/notifications',
		await deviceSubscription(endpoint),
		await accessHeaders(EMAIL_OF[userId])
	);

/** The fake push service: its status per endpoint (201 by default), and what it received. */
let pushServiceStatusOf: Record<string, number>;
const pushedEndpoints = () =>
	vi
		.mocked(fetch)
		.mock.calls.map(([url]) => String(url))
		.filter((url) => url.startsWith('https://push.example/'))
		.sort();
/**
 * The pushes go out through `waitUntil` from cloudflare:workers, which `waitOnExecutionContext`
 * doesn't wait for: poll until they're there.
 */
const pushedEndpointsSoon = () => expect.poll(pushedEndpoints);
/** For "nothing was pushed": long enough for a push that was going to go out. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

const logChore = async (authorId: FamilyUserId, performerId: FamilyUserId, choreId = uuidV7()) =>
	postJson(
		'/api/chores',
		{
			id: choreId,
			choreTypeId: DISHES_ID,
			durationMinutes: 45,
			startedAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
			note: null,
			performerUserId: performerId
		},
		await accessHeaders(EMAIL_OF[authorId])
	);

const savedEndpoints = () =>
	env.DB.prepare('SELECT endpoint FROM push_subscriptions ORDER BY endpoint')
		.all<{ endpoint: string }>()
		.then(({ results }) => results.map((row) => row.endpoint));

beforeEach(async () => {
	pushServiceStatusOf = {};
	stubOutboundFetch(async (url) => new Response(null, { status: pushServiceStatusOf[url] ?? 201 }));
	await resetFamily();
	await seedFamily();
	for (const userId of [ADMIN_ID, PARENT_ID, CHILD_ID, SECOND_CHILD_ID] as const)
		expect((await subscribeDevice(userId)).status).toBe(204);
});
afterEach(() => vi.unstubAllGlobals());

describe('a new chore', () => {
	it("pushes an encrypted, VAPID-signed notification to each recipient's device, never the author's", async () => {
		expect((await logChore(CHILD_ID, CHILD_ID)).status).toBe(201);
		await pushedEndpointsSoon().toEqual(
			[PHONE_OF[ADMIN_ID], PHONE_OF[PARENT_ID], PHONE_OF[SECOND_CHILD_ID]].sort()
		);
		const [, init] = vi
			.mocked(fetch)
			.mock.calls.find(([url]) => String(url) === PHONE_OF[ADMIN_ID])!;
		expect(init?.headers).toMatchObject({
			'content-encoding': 'aes128gcm',
			ttl: '86400',
			authorization: expect.stringMatching(/^vapid t=.+, k=.+/)
		});
	});

	it("follows the Q11 matrix: a parent's own chore reaches no child", async () => {
		await logChore(PARENT_ID, PARENT_ID);
		await pushedEndpointsSoon().toEqual([PHONE_OF[ADMIN_ID]]);
		await settle();
		expect(pushedEndpoints()).toEqual([PHONE_OF[ADMIN_ID]]);
	});

	it('reaches the child it was logged for', async () => {
		await logChore(PARENT_ID, CHILD_ID);
		await pushedEndpointsSoon().toEqual(
			[PHONE_OF[ADMIN_ID], PHONE_OF[CHILD_ID], PHONE_OF[SECOND_CHILD_ID]].sort()
		);
	});

	it('reaches every device of a recipient, and a device moves to whoever subscribed it last', async () => {
		await subscribeDevice(ADMIN_ID, 'https://push.example/papa-laptop');
		await subscribeDevice(PARENT_ID, PHONE_OF[SECOND_CHILD_ID]); // Noé's phone, now Maman's
		await logChore(CHILD_ID, CHILD_ID);
		await pushedEndpointsSoon().toEqual(
			[
				'https://push.example/papa-laptop',
				PHONE_OF[ADMIN_ID],
				PHONE_OF[PARENT_ID],
				PHONE_OF[SECOND_CHILD_ID]
			].sort()
		);
	});

	it('deletes a subscription the push service says is gone (404/410)', async () => {
		pushServiceStatusOf[PHONE_OF[ADMIN_ID]] = 410;
		pushServiceStatusOf[PHONE_OF[PARENT_ID]] = 404;
		expect((await logChore(CHILD_ID, CHILD_ID)).status).toBe(201);
		await expect
			.poll(savedEndpoints)
			.toEqual([PHONE_OF[CHILD_ID], PHONE_OF[SECOND_CHILD_ID]].sort());
	});

	it('logs any other failure, keeps the subscription and does not retry', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		pushServiceStatusOf[PHONE_OF[ADMIN_ID]] = 503;
		expect((await logChore(CHILD_ID, CHILD_ID)).status).toBe(201);
		await expect
			.poll(() => consoleError.mock.calls)
			.toContainEqual(['Push refused', 'push.example', 503]);
		await settle();
		expect(pushedEndpoints().filter((url) => url === PHONE_OF[ADMIN_ID])).toHaveLength(1);
		expect(await savedEndpoints()).toContain(PHONE_OF[ADMIN_ID]);
		consoleError.mockRestore();
	});

	it('pushes nothing for a retry of the same chore, an edit or a delete', async () => {
		const choreId = uuidV7();
		await logChore(CHILD_ID, CHILD_ID, choreId);
		await pushedEndpointsSoon().toHaveLength(3);
		vi.mocked(fetch).mockClear();

		expect((await logChore(CHILD_ID, CHILD_ID, choreId)).status).toBe(200);
		const headers = await accessHeaders(EMAIL_OF[CHILD_ID]);
		const chore = await env.DB.prepare('SELECT started_at FROM chores WHERE id = ?')
			.bind(choreId)
			.first<{ started_at: string }>();
		const edit = await postFormAction(
			'/historique?/updateChore',
			{
				id: choreId,
				choreTypeId: DISHES_ID,
				durationMinutes: '60',
				startedAt: chore!.started_at,
				note: '',
				performerUserId: CHILD_ID
			},
			headers
		);
		expect(edit.type).toBe('success');
		expect((await postFormAction('/historique?/deleteChore', { id: choreId }, headers)).type).toBe(
			'success'
		);
		await settle();
		expect(pushedEndpoints()).toEqual([]);
	});

	it("skips a deactivated user's devices", async () => {
		await env.DB.prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
			.bind(new Date().toISOString(), PARENT_ID)
			.run();
		await logChore(CHILD_ID, CHILD_ID);
		await pushedEndpointsSoon().toEqual([PHONE_OF[ADMIN_ID], PHONE_OF[SECOND_CHILD_ID]].sort());
	});
});

describe("Réglages' notifications toggle", () => {
	it('refuses a subscription that is not one (no https endpoint, no keys)', async () => {
		const headers = await accessHeaders(EMAIL_OF[ADMIN_ID]);
		for (const body of [
			{ endpoint: 'http://push.example/x', keys: { p256dh: 'a', auth: 'b' } },
			{ endpoint: 'https://push.example/x' },
			null
		])
			expect((await postJson('/reglages/notifications', body, headers)).status).toBe(400);
	});

	it('forgets the device when turned off', async () => {
		const res = await sendJson(
			'DELETE',
			'/reglages/notifications',
			{ endpoint: PHONE_OF[ADMIN_ID] },
			await accessHeaders(EMAIL_OF[ADMIN_ID])
		);
		expect(res.status).toBe(204);
		expect(await savedEndpoints()).not.toContain(PHONE_OF[ADMIN_ID]);
	});
});

describe("Réglages' Tester", () => {
	const testDevice = async (userId: FamilyUserId, endpoint: string) =>
		(
			await postJson(
				'/reglages/notifications/test',
				{ endpoint },
				await accessHeaders(EMAIL_OF[userId])
			)
		).status;

	it("pushes to the viewer's own device straight away", async () => {
		expect(await testDevice(PARENT_ID, PHONE_OF[PARENT_ID])).toBe(204);
		expect(pushedEndpoints()).toEqual([PHONE_OF[PARENT_ID]]);
	});

	it("refuses someone else's device, and says when the device has unsubscribed", async () => {
		expect(await testDevice(PARENT_ID, PHONE_OF[ADMIN_ID])).toBe(404);
		expect(await testDevice(PARENT_ID, 'http://push.example/not-https')).toBe(400);
		pushServiceStatusOf[PHONE_OF[PARENT_ID]] = 410;
		expect(await testDevice(PARENT_ID, PHONE_OF[PARENT_ID])).toBe(410);
		expect(await savedEndpoints()).not.toContain(PHONE_OF[PARENT_ID]);
	});
});
