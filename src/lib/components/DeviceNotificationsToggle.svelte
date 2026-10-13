<!-- Réglages' "Notifications sur cet appareil" + Tester (spec Q10, Q11; prototype 02): this browser's push subscription. Logic copied from notakid's Réglages. -->
<script lang="ts">
	import { getShowToast } from '#lib/app-context.js';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	let { vapidPublicKey }: { vapidPublicKey: string } = $props();
	const showToast = getShowToast();

	/** This device's state. `unsupported`: a browser without Web Push (iPhone, spec Q12). */
	let deviceNotifications = $state<'unsupported' | 'denied' | 'off' | 'on' | 'busy'>('off');
	let isTesting = $state(false);

	const sendPushSubscriptionRequest = async (
		method: 'POST' | 'DELETE',
		body: object,
		path: '/reglages/notifications' | '/reglages/notifications/test' = '/reglages/notifications'
	) => {
		const response = await fetch(resolve(path), {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) throw new Error(String(response.status));
	};
	const saveSubscription = (subscription: PushSubscription) =>
		sendPushSubscriptionRequest('POST', subscription.toJSON());

	onMount(async () => {
		if (!('serviceWorker' in navigator) || !('PushManager' in window))
			return void (deviceNotifications = 'unsupported');
		if (Notification.permission === 'denied') return void (deviceNotifications = 'denied');
		const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
		deviceNotifications = subscription ? 'on' : 'off';
		// Saved again: the server may have dropped it (404/410), or someone else used this device.
		if (subscription) await saveSubscription(subscription).catch(() => {});
	});

	// The permission is asked here, on the viewer's tap.
	const toggleDeviceNotifications = async (toggle: HTMLInputElement) => {
		const wasOn = deviceNotifications === 'on';
		deviceNotifications = 'busy';
		try {
			const { pushManager } = await navigator.serviceWorker.ready;
			if (wasOn) {
				const subscription = await pushManager.getSubscription();
				if (subscription) {
					await sendPushSubscriptionRequest('DELETE', { endpoint: subscription.endpoint });
					await subscription.unsubscribe();
				}
				deviceNotifications = 'off';
				return;
			}
			if ((await Notification.requestPermission()) !== 'granted')
				return void (deviceNotifications = 'denied');
			const subscription = await pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: vapidPublicKey
			});
			await saveSubscription(subscription);
			deviceNotifications = 'on';
		} catch {
			showToast(
				navigator.onLine ? 'Échec : réessaie' : 'Pas de réseau : réessaie quand il revient'
			);
			deviceNotifications = wasOn ? 'on' : 'off';
		} finally {
			// `checked` stays as tapped when the state ends where it started (refused, failed).
			toggle.checked = deviceNotifications === 'on';
		}
	};

	const requestTestNotification = async () => {
		isTesting = true;
		try {
			const subscription = await (
				await navigator.serviceWorker.ready
			).pushManager.getSubscription();
			if (!subscription) throw new Error('no subscription');
			await sendPushSubscriptionRequest(
				'POST',
				{ endpoint: subscription.endpoint },
				'/reglages/notifications/test'
			);
			showToast('🔔 Notification de test envoyée');
		} catch {
			showToast('Pas envoyée : désactive puis réactive les notifications');
		} finally {
			isTesting = false;
		}
	};
</script>

<div class="space-y-1 text-sm">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				class="toggle shrink-0 toggle-primary"
				checked={deviceNotifications === 'on'}
				disabled={deviceNotifications === 'unsupported' ||
					deviceNotifications === 'denied' ||
					deviceNotifications === 'busy'}
				onchange={(event) => toggleDeviceNotifications(event.currentTarget)}
			/>
			Notifications sur cet appareil
		</label>
		<button
			type="button"
			class="btn btn-sm"
			disabled={deviceNotifications !== 'on' || isTesting}
			onclick={requestTestNotification}
		>
			{#if isTesting}<span class="loading loading-sm loading-spinner"></span>{/if}
			Tester
		</button>
	</div>
	{#if deviceNotifications === 'unsupported'}
		<p class="opacity-70">
			Ce navigateur ne reçoit pas les notifications : utilise Chrome, Firefox ou Edge, sur
			ordinateur ou Android.
		</p>
	{:else if deviceNotifications === 'denied'}
		<p class="opacity-70">Notifications refusées : autorise-les dans les réglages du navigateur.</p>
	{/if}
</div>
