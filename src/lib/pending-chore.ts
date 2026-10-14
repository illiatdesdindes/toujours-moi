// The quick log's pending chore (spec Q4): tapping a type starts a 5 s countdown; it then commits,
// unless cancelled or taken for editing. Hiding the page commits it at once (flush). A tap on the
// pending chore's own type is ignored: a double click or a "did it work?" click, never a second chore.

/** Spec Q10: a constant, not a setting. */
export const PENDING_DELAY_MS = 5000;

export const createPendingChore = <Chore extends { choreTypeId: string }>({
	commit,
	onChange,
	delayMs = PENDING_DELAY_MS
}: {
	commit: (chore: Chore) => void;
	/** The chore on show, or null once it's gone. */
	onChange: (chore: Chore | null) => void;
	delayMs?: number;
}) => {
	let pending: { chore: Chore; timer: ReturnType<typeof setTimeout> } | null = null;

	/** Stops the countdown and returns the chore it held. */
	const takePendingChore = () => {
		if (!pending) return null;
		clearTimeout(pending.timer);
		const { chore } = pending;
		pending = null;
		onChange(null);
		return chore;
	};
	const flush = () => {
		const chore = takePendingChore();
		if (chore) commit(chore);
	};

	return {
		get current() {
			return pending?.chore ?? null;
		},
		/** A tap on another type commits the first chore (prototype 02); on the same type, it's ignored. */
		start(chore: Chore) {
			if (pending?.chore.choreTypeId === chore.choreTypeId) return;
			flush();
			pending = { chore, timer: setTimeout(flush, delayMs) };
			onChange(chore);
		},
		cancel() {
			takePendingChore();
		},
		takeForEdit: takePendingChore,
		flush
	};
};
