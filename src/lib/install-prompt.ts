// The "Installer TJM" button of the install screen (spec Q12): Chrome's `beforeinstallprompt`,
// kept so the button can show it. Who sees the install screen is CSS (`install-gate` in layout.css).

/** Chrome's `BeforeInstallPromptEvent` (not in the DOM types: Chromium only). */
export type DeferredInstallPrompt = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallPromptOutcome = 'accepted' | 'dismissed' | 'unavailable';

/** Listens on `target` (the window); `onCanPromptChange` says whether the button can prompt. */
export const listenForInstallPrompt = (
	target: EventTarget,
	onCanPromptChange: (canPrompt: boolean) => void
) => {
	let deferredInstallPrompt: DeferredInstallPrompt | null = null;
	const setDeferredInstallPrompt = (prompt: DeferredInstallPrompt | null) => {
		deferredInstallPrompt = prompt;
		onCanPromptChange(prompt !== null);
	};
	const keepPrompt = (event: Event) => {
		event.preventDefault(); // our button instead of Chrome's mini-infobar
		setDeferredInstallPrompt(event as DeferredInstallPrompt);
	};
	const dropPrompt = () => setDeferredInstallPrompt(null);
	target.addEventListener('beforeinstallprompt', keepPrompt);
	target.addEventListener('appinstalled', dropPrompt);

	return {
		async promptInstall(): Promise<InstallPromptOutcome> {
			const prompt = deferredInstallPrompt;
			if (!prompt) return 'unavailable';
			// A prompt shows once; Chrome fires a new `beforeinstallprompt` when it allows another.
			setDeferredInstallPrompt(null);
			await prompt.prompt();
			return (await prompt.userChoice).outcome;
		},
		stopListening() {
			target.removeEventListener('beforeinstallprompt', keepPrompt);
			target.removeEventListener('appinstalled', dropPrompt);
		}
	};
};
