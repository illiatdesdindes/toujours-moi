import { describe, expect, it, vi } from 'vitest';
import { listenForInstallPrompt, type DeferredInstallPrompt } from './install-prompt';

/** A `beforeinstallprompt` event as Chrome fires it, with the outcome the user will pick. */
const installPromptEvent = (outcome: 'accepted' | 'dismissed') => {
	const event = new Event('beforeinstallprompt', { cancelable: true }) as Event &
		DeferredInstallPrompt;
	event.prompt = vi.fn(async () => {});
	event.userChoice = Promise.resolve({ outcome });
	return event;
};

describe('listenForInstallPrompt', () => {
	it("keeps Chrome's prompt for the button instead of letting Chrome show its own", () => {
		const target = new EventTarget();
		const onCanPromptChange = vi.fn();
		listenForInstallPrompt(target, onCanPromptChange);
		const event = installPromptEvent('accepted');
		target.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(onCanPromptChange).toHaveBeenLastCalledWith(true);
	});

	it('answers unavailable when Chrome never offered the prompt (the fallback text applies)', async () => {
		const installPrompt = listenForInstallPrompt(new EventTarget(), () => {});
		expect(await installPrompt.promptInstall()).toBe('unavailable');
	});

	it.each(['accepted', 'dismissed'] as const)(
		'shows the prompt once, answers %s, then has no prompt left',
		async (outcome) => {
			const target = new EventTarget();
			const onCanPromptChange = vi.fn();
			const installPrompt = listenForInstallPrompt(target, onCanPromptChange);
			const event = installPromptEvent(outcome);
			target.dispatchEvent(event);
			expect(await installPrompt.promptInstall()).toBe(outcome);
			expect(event.prompt).toHaveBeenCalledOnce();
			expect(onCanPromptChange).toHaveBeenLastCalledWith(false);
			// A prompt can't be shown twice: wait for Chrome to fire a new one.
			expect(await installPrompt.promptInstall()).toBe('unavailable');
		}
	);

	it('drops the prompt once the app is installed another way (Chrome menu)', async () => {
		const target = new EventTarget();
		const onCanPromptChange = vi.fn();
		const installPrompt = listenForInstallPrompt(target, onCanPromptChange);
		target.dispatchEvent(installPromptEvent('accepted'));
		target.dispatchEvent(new Event('appinstalled'));
		expect(onCanPromptChange).toHaveBeenLastCalledWith(false);
		expect(await installPrompt.promptInstall()).toBe('unavailable');
	});

	it('stops listening', () => {
		const target = new EventTarget();
		const onCanPromptChange = vi.fn();
		listenForInstallPrompt(target, onCanPromptChange).stopListening();
		const event = installPromptEvent('accepted');
		target.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(onCanPromptChange).not.toHaveBeenCalled();
	});
});
