import { describe, expect, it, vi } from 'vitest';
import {
	CHORE_OUTBOX_STORAGE_KEY,
	createChoreOutbox,
	sendChoreToServer,
	type SendOutcome
} from './chore-outbox';
import type { ChoreFields } from './domain';

const chore = (id: string): ChoreFields => ({
	id,
	choreTypeId: 'type-dishes',
	durationMinutes: 45,
	startedAt: '2026-10-13T12:00:00.000Z',
	note: null,
	performerUserId: 'papa'
});

const memoryStorage = () => {
	const values = new Map<string, string>();
	return {
		getItem: (storageKey: string) => values.get(storageKey) ?? null,
		setItem: (storageKey: string, text: string) => void values.set(storageKey, text),
		values
	};
};

const outboxWith = (outcomes: SendOutcome[], storage = memoryStorage(), viewerId = 'papa') => {
	const send = vi.fn<(chore: ChoreFields) => Promise<SendOutcome>>(
		async () => outcomes.shift() ?? 'saved'
	);
	const rejected: [string, string, string | undefined][] = [];
	const outbox = createChoreOutbox({
		storage,
		viewerId,
		send,
		onRejected: (rejectedChore, message, choreLabel) =>
			rejected.push([rejectedChore.id, message, choreLabel])
	});
	return { outbox, send, rejected, storage };
};

describe('chore outbox', () => {
	it('sends a chore and forgets it once the server has it', async () => {
		const { outbox, send } = outboxWith(['saved']);
		await outbox.submit(chore('a'));
		expect(send).toHaveBeenCalledWith(chore('a'));
		expect(outbox.unsentChores()).toEqual([]);
	});

	it('keeps a chore that failed to send, and retries it later', async () => {
		const { outbox, send } = outboxWith(['retry', 'saved']);
		await outbox.submit(chore('a'));
		expect(outbox.unsentChores()).toEqual([chore('a')]);
		await outbox.retry();
		expect(send).toHaveBeenCalledTimes(2);
		expect(outbox.unsentChores()).toEqual([]);
	});

	it('survives a reload: the chore is stored before it is sent', async () => {
		const storage = memoryStorage();
		const firstPage = outboxWith([new Promise<never>(() => {}) as never], storage);
		void firstPage.outbox.submit(chore('a')); // the page dies mid-request
		const reopened = outboxWith(['saved'], storage);
		expect(reopened.outbox.unsentChores()).toEqual([chore('a')]);
		await reopened.outbox.retry();
		expect(reopened.outbox.unsentChores()).toEqual([]);
	});

	it('sends the waiting chores on the next quick log too, oldest first', async () => {
		const { outbox, send } = outboxWith(['retry', 'saved', 'saved']);
		await outbox.submit(chore('a'));
		await outbox.submit(chore('b'));
		expect(send.mock.calls.map(([sent]) => sent.id)).toEqual(['a', 'a', 'b']);
		expect(outbox.unsentChores()).toEqual([]);
	});

	it('drops a chore the server refuses, and says which one', async () => {
		const { outbox, rejected } = outboxWith([{ rejected: 'Pas de tâche dans le futur' }]);
		expect(await outbox.submit(chore('a'), 'Vaisselle · 45 min')).toBe(false);
		expect(outbox.unsentChores()).toEqual([]);
		expect(rejected).toEqual([['a', 'Pas de tâche dans le futur', 'Vaisselle · 45 min']]);
	});

	it('tells the caller when the chore still waits for the network', async () => {
		const { outbox } = outboxWith(['retry', 'saved']);
		expect(await outbox.submit(chore('a'))).toBe(true);
		expect(await outbox.submit(chore('b'))).toBe(false);
	});

	it("never sends another viewer's chores", async () => {
		const storage = memoryStorage();
		await outboxWith(['retry'], storage, 'lea').outbox.submit(chore('lea-chore'));
		const papa = outboxWith([], storage, 'papa');
		await papa.outbox.retry();
		expect(papa.send).not.toHaveBeenCalled();
		expect(outboxWith([], storage, 'lea').outbox.unsentChores()).toEqual([chore('lea-chore')]);
	});

	it('runs one send at a time when retries overlap', async () => {
		const { outbox, send } = outboxWith([]);
		await Promise.all([outbox.submit(chore('a')), outbox.retry(), outbox.retry()]);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('treats an unreadable outbox as empty', () => {
		const storage = memoryStorage();
		storage.setItem(CHORE_OUTBOX_STORAGE_KEY, '{nope');
		expect(outboxWith([], storage).outbox.unsentChores()).toEqual([]);
	});
});

describe('sendChoreToServer', () => {
	const respond = (status: number, body: unknown = {}) =>
		vi.fn(async () => new Response(JSON.stringify(body), { status }));

	it('POSTs the chore as JSON, kept alive past the page', async () => {
		const fetchChore = respond(201, { id: 'a' });
		expect(await sendChoreToServer(chore('a'), fetchChore)).toBe('saved');
		expect(fetchChore).toHaveBeenCalledWith('/api/chores', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(chore('a')),
			keepalive: true
		});
	});

	it('is saved when the server already had it (200)', async () => {
		expect(await sendChoreToServer(chore('a'), respond(200, { id: 'a' }))).toBe('saved');
	});

	it.each([400, 409])('is rejected with the server message on %i', async (status) => {
		expect(await sendChoreToServer(chore('a'), respond(status, { message: 'Non' }))).toEqual({
			rejected: 'Non'
		});
	});

	it.each([403, 429, 500, 503])('retries on %i', async (status) => {
		expect(await sendChoreToServer(chore('a'), respond(status))).toBe('retry');
	});

	it("retries when the answer isn't the chore's (e.g. Access's login page after the session ended)", async () => {
		const loginPage = vi.fn(async () => new Response('<html>', { status: 200 }));
		expect(await sendChoreToServer(chore('a'), loginPage)).toBe('retry');
	});

	it('retries when the network fails', async () => {
		const offline = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		expect(await sendChoreToServer(chore('a'), offline)).toBe('retry');
	});
});
