import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingChore, PENDING_DELAY_MS } from './pending-chore';

const dishes = { id: 'chore-1', label: 'Vaisselle' };
const laundry = { id: 'chore-2', label: 'Lessive' };

describe('pending chore', () => {
	let committed: (typeof dishes)[];
	let shown: (typeof dishes | null)[];
	let pendingChore: ReturnType<typeof createPendingChore<typeof dishes>>;
	beforeEach(() => {
		vi.useFakeTimers();
		committed = [];
		shown = [];
		pendingChore = createPendingChore<typeof dishes>({
			commit: (chore) => committed.push(chore),
			onChange: (chore) => shown.push(chore)
		});
	});
	afterEach(() => vi.useRealTimers());

	it('waits 5 s, then commits once', () => {
		pendingChore.start(dishes);
		expect(pendingChore.current).toBe(dishes);
		vi.advanceTimersByTime(PENDING_DELAY_MS - 1);
		expect(committed).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(committed).toEqual([dishes]);
		expect(pendingChore.current).toBeNull();
		expect(shown).toEqual([dishes, null]);
		vi.advanceTimersByTime(PENDING_DELAY_MS);
		expect(committed).toEqual([dishes]);
	});

	it('commits nothing when cancelled', () => {
		pendingChore.start(dishes);
		pendingChore.cancel();
		vi.advanceTimersByTime(PENDING_DELAY_MS * 2);
		expect(committed).toEqual([]);
		expect(pendingChore.current).toBeNull();
	});

	it('hands the chore over for editing and stops the countdown', () => {
		pendingChore.start(dishes);
		vi.advanceTimersByTime(2000);
		expect(pendingChore.takeForEdit()).toBe(dishes);
		vi.advanceTimersByTime(PENDING_DELAY_MS * 2);
		expect(committed).toEqual([]);
		expect(pendingChore.current).toBeNull();
		expect(pendingChore.takeForEdit()).toBeNull();
	});

	it('commits right away on flush (page hidden), and only once', () => {
		pendingChore.start(dishes);
		pendingChore.flush();
		expect(committed).toEqual([dishes]);
		pendingChore.flush();
		vi.advanceTimersByTime(PENDING_DELAY_MS * 2);
		expect(committed).toEqual([dishes]);
	});

	it('commits the first chore when a second one starts', () => {
		pendingChore.start(dishes);
		vi.advanceTimersByTime(3000);
		pendingChore.start(laundry);
		expect(committed).toEqual([dishes]);
		vi.advanceTimersByTime(PENDING_DELAY_MS - 1);
		expect(committed).toEqual([dishes]);
		vi.advanceTimersByTime(1);
		expect(committed).toEqual([dishes, laundry]);
	});

	it('does nothing on cancel or flush with nothing pending', () => {
		pendingChore.cancel();
		pendingChore.flush();
		expect(committed).toEqual([]);
		expect(shown).toEqual([]);
	});
});
