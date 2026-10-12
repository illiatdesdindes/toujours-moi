// What the root layout gives every page: the chore outbox and the one toast.
import { createContext } from 'svelte';
import type { createChoreOutbox } from './chore-outbox';

export const [getChoreOutbox, setChoreOutbox] =
	createContext<ReturnType<typeof createChoreOutbox>>();

/** Shows a short message above the dock for a couple of seconds. */
export const [getShowToast, setShowToast] = createContext<(message: string) => void>();
