// The chore outbox (spec Q20 point 1), v1's only local-first piece. Every committed chore is
// stored before it's sent (so a page closed mid-request loses nothing), and stays until the
// server has it. Retried on `online`, on reopening the app and on the next quick log; the server's
// POST /api/chores is idempotent by the browser-made id, so sending twice is harmless.

import type { ChoreFields } from './domain';

export type SendOutcome = 'saved' | 'retry' | { rejected: string };

export const CHORE_OUTBOX_STORAGE_KEY = 'tjm.chore-outbox.v1';

/**
 * Who logged each chore: on a shared browser, a chore is only ever sent as its own author.
 * `choreLabel` (`Vaisselle · 45 min`) names it if it's refused on a later visit; optional, older entries lack it.
 */
type OutboxEntry = { viewerId: string; chore: ChoreFields; choreLabel?: string | undefined };

export const createChoreOutbox = ({
	storage,
	viewerId,
	send,
	onRejected
}: {
	storage: Pick<Storage, 'getItem' | 'setItem'>;
	viewerId: string;
	send: (chore: ChoreFields) => Promise<SendOutcome>;
	/** The server refused it for good (e.g. a future chore): dropped, never retried. */
	onRejected: (chore: ChoreFields, message: string, choreLabel: string | undefined) => void;
}) => {
	// Read on every use: another tab may have changed it.
	const readEntries = (): OutboxEntry[] => {
		try {
			const entries: unknown = JSON.parse(storage.getItem(CHORE_OUTBOX_STORAGE_KEY) ?? '[]');
			return Array.isArray(entries) ? entries : [];
		} catch {
			return [];
		}
	};
	const writeEntries = (entries: OutboxEntry[]) =>
		storage.setItem(CHORE_OUTBOX_STORAGE_KEY, JSON.stringify(entries));
	const removeOutboxEntry = (choreId: string) =>
		writeEntries(readEntries().filter((entry) => entry.chore.id !== choreId));
	const viewerEntries = () => readEntries().filter((entry) => entry.viewerId === viewerId);
	const unsentChores = () => viewerEntries().map((entry) => entry.chore);

	/** One pass, oldest first; stops at the first chore that can't be sent yet (offline). */
	const sendUnsent = async () => {
		for (const { chore, choreLabel } of viewerEntries()) {
			const outcome = await send(chore);
			if (outcome === 'retry') return;
			removeOutboxEntry(chore.id);
			if (outcome !== 'saved') onRejected(chore, outcome.rejected, choreLabel);
		}
	};
	// Passes never overlap, so a chore isn't sent twice at once.
	let lastPass = Promise.resolve();
	const retry = () => (lastPass = lastPass.then(sendUnsent));

	return {
		unsentChores,
		retry,
		/** Resolves to true when the chore still waits in the outbox (offline), false once sent or refused. */
		async submit(chore: ChoreFields, choreLabel?: string) {
			writeEntries([...readEntries(), { viewerId, chore, choreLabel }]);
			await retry();
			return unsentChores().some((unsent) => unsent.id === chore.id);
		}
	};
};

/**
 * Refusals that won't change on a retry (the access policy's refusal is a 422). Not 403:
 * hooks.server.ts answers it when the Access JWT doesn't verify (e.g. the certs fetch failed), and
 * dropping a chore is worse than retrying.
 */
const REJECTED_STATUSES = new Set([400, 404, 409, 422]);

/** Sends one chore. 403, 429, 5xx, a network failure or a page that isn't ours (Access's login) → retry. */
export const sendChoreToServer = async (
	chore: ChoreFields,
	fetchChore: typeof fetch = fetch
): Promise<SendOutcome> => {
	try {
		const res = await fetchChore('/api/chores', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(chore),
			keepalive: true // the pending chore is also flushed on pagehide
		});
		const answer = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
		if (res.ok) return answer?.id === chore.id ? 'saved' : 'retry';
		if (REJECTED_STATUSES.has(res.status))
			return { rejected: answer?.message ?? "La tâche n'a pas pu être enregistrée" };
		return 'retry';
	} catch {
		return 'retry';
	}
};

/** `localStorage`, or memory when the browser refuses it (private window, blocked site data). */
export const localStorageOrMemory = (): Pick<Storage, 'getItem' | 'setItem'> => {
	const memory = new Map<string, string>();
	return {
		getItem(storageKey) {
			try {
				return localStorage.getItem(storageKey);
			} catch {
				return memory.get(storageKey) ?? null;
			}
		},
		setItem(storageKey, text) {
			try {
				localStorage.setItem(storageKey, text);
			} catch {
				memory.set(storageKey, text);
			}
		}
	};
};
