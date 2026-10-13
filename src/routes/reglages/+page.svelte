<!-- Réglages (spec Q10, prototype 02): Mon profil for everyone, Enfants for parents, Membres and Types de tâches for the admin. Every form saves through a form action of this page. -->
<script lang="ts">
	import { getShowToast } from '#lib/app-context.js';
	import ChoreTypeFields from '#lib/components/ChoreTypeFields.svelte';
	import PersonColourDot from '#lib/components/PersonColourDot.svelte';
	import PersonalColourPicker from '#lib/components/PersonalColourPicker.svelte';
	import PersonNameInput from '#lib/components/PersonNameInput.svelte';
	import UserRoleSelect from '#lib/components/UserRoleSelect.svelte';
	import { COLOUR_KEYS } from '#lib/domain.js';
	import { enhance, type SubmitFunction } from '$app/forms';

	let { data, form } = $props();
	const showToast = getShowToast();

	/**
	 * Saves, reloads the page's data, and says how it went in the toast. A button's
	 * `data-success-message` overrides `successMessage`; `reset` empties an Ajouter form.
	 */
	const saveWithToast =
		(successMessage: string, { reset = false } = {}): SubmitFunction =>
		({ submitter }) => {
			// Read before the reload re-renders the button for the new state.
			const message = (submitter as HTMLElement | null)?.dataset.successMessage ?? successMessage;
			return async ({ result, update }) => {
				await update({ reset });
				if (result.type === 'success') showToast(message);
				else if (result.type === 'failure') showToast(String(result.data?.message ?? 'Refusé'));
				else showToast('Erreur du serveur : réessaie');
			};
		};

	/** As prototype 02: the first palette colour nobody wears yet, so two people don't share one. */
	const newUserColourKey = $derived(
		COLOUR_KEYS.find(
			(colourKey) => !data.userAccounts?.some((userAccount) => userAccount.colourKey === colourKey)
		) ?? COLOUR_KEYS[0]
	);
</script>

<div class="space-y-5">
	<section class="space-y-3 rounded-box bg-base-100 p-4 pop-edge" aria-labelledby="my-profile">
		<h2 id="my-profile" class="font-bold">Mon profil</h2>
		<form
			method="POST"
			action="?/updatePersonDetails"
			class="space-y-3"
			use:enhance={saveWithToast('Profil enregistré')}
		>
			<input type="hidden" name="id" value={data.viewer.id} />
			<label class="block text-sm"
				>Prénom<PersonNameInput
					class="input w-full"
					value={data.viewer.name}
					autocomplete="given-name"
				/></label
			>
			<div class="text-sm">
				<span aria-hidden="true">Couleur</span>
				<div class="mt-1"><PersonalColourPicker selectedColourKey={data.viewer.colourKey} /></div>
			</div>
			<button class="btn btn-primary btn-sm">Enregistrer</button>
		</form>
	</section>

	{#if data.children}
		<section class="space-y-3 rounded-box bg-base-100 p-4 pop-edge" aria-labelledby="children">
			<h2 id="children" class="font-bold">Enfants</h2>
			{#each data.children as child (child.id)}
				<form
					method="POST"
					action="?/updatePersonDetails"
					class="flex flex-wrap items-center gap-2"
					use:enhance={saveWithToast(`${child.name} enregistré·e`)}
				>
					<input type="hidden" name="id" value={child.id} />
					<PersonNameInput class="input w-32 input-sm" value={child.name} aria-label="Prénom" />
					<PersonalColourPicker selectedColourKey={child.colourKey} size="sm" />
					<button class="btn btn-sm">Enregistrer</button>
				</form>
			{:else}
				<p class="text-sm opacity-70">Pas encore d'enfant : l'admin les ajoute.</p>
			{/each}
		</section>
	{/if}

	{#if data.userAccounts}
		<section class="space-y-3 rounded-box bg-base-100 p-4 pop-edge" aria-labelledby="members">
			<h2 id="members" class="font-bold">Membres</h2>
			{#each data.userAccounts as userAccount (userAccount.id)}
				{@const userActionsFormId = `user-actions-${userAccount.id}`}
				<!-- Désactiver / Réactiver post this form, so Entrée in the fields below stays Enregistrer. -->
				<form
					id={userActionsFormId}
					method="POST"
					hidden
					use:enhance={saveWithToast(`${userAccount.name} enregistré·e`)}
				>
					<input type="hidden" name="id" value={userAccount.id} />
				</form>
				<form
					method="POST"
					action="?/updateUserAsAdmin"
					class={[
						'space-y-2 border-b-2 border-base-content/15 pb-3 text-sm',
						!userAccount.isActive && 'opacity-60'
					]}
					use:enhance={saveWithToast(`${userAccount.name} enregistré·e`)}
				>
					<input type="hidden" name="id" value={userAccount.id} />
					<div class="flex flex-wrap items-center gap-2">
						<PersonColourDot colourKey={userAccount.colourKey} />
						<PersonNameInput
							class="input w-32 input-sm"
							value={userAccount.name}
							aria-label="Prénom"
						/>
						{#if userAccount.isLastActiveAdmin}
							<input type="hidden" name="role" value={userAccount.role} />
						{/if}
						<UserRoleSelect
							class="select w-28 select-sm"
							selectedRole={userAccount.role}
							disabled={userAccount.isLastActiveAdmin}
							title={userAccount.isLastActiveAdmin
								? 'Il faut toujours au moins un admin actif'
								: undefined}
						/>
						{#if !userAccount.isActive}<span class="badge badge-sm">désactivé·e</span>{/if}
					</div>
					<p class="truncate opacity-70">{userAccount.email}</p>
					<PersonalColourPicker selectedColourKey={userAccount.colourKey} size="sm" />
					<div class="flex flex-wrap gap-2">
						<button class="btn btn-sm">Enregistrer</button>
						<button
							class="btn btn-sm"
							form={userActionsFormId}
							formaction={userAccount.isActive ? '?/deactivateUser' : '?/reactivateUser'}
							data-success-message={userAccount.isActive
								? `${userAccount.name} désactivé·e`
								: `${userAccount.name} réactivé·e`}
							disabled={userAccount.isLastActiveAdmin}
							title={userAccount.isLastActiveAdmin
								? 'Il faut toujours au moins un admin actif'
								: undefined}>{userAccount.isActive ? 'Désactiver' : 'Réactiver'}</button
						>
					</div>
				</form>
			{/each}

			<form
				method="POST"
				action="?/addUser"
				class="space-y-2 text-sm"
				use:enhance={saveWithToast('Membre ajouté', { reset: true })}
			>
				<h3 class="font-semibold">Ajouter un membre</h3>
				<div class="grid grid-cols-2 gap-2 md:grid-cols-3">
					<input
						class="input col-span-2 w-full input-sm md:col-span-1"
						type="email"
						name="email"
						required
						placeholder="email"
						aria-label="Email"
						autocomplete="off"
					/>
					<PersonNameInput
						class="input w-full input-sm"
						placeholder="prénom"
						aria-label="Prénom"
						autocomplete="off"
					/>
					<UserRoleSelect class="select w-full select-sm" selectedRole="child" />
				</div>
				<PersonalColourPicker selectedColourKey={newUserColourKey} size="sm" />
				<button class="btn btn-primary btn-sm">Ajouter</button>
			</form>
			{#if form && 'addedUserEmail' in form}
				<div role="alert" class="alert text-sm alert-warning">
					<span
						>Ajoute aussi <b>{form.addedUserEmail}</b> à la politique Cloudflare Access, sinon cette personne
						ne pourra pas se connecter.</span
					>
				</div>
			{/if}
		</section>
	{/if}

	{#if data.choreTypeCatalog}
		<section class="space-y-2 rounded-box bg-base-100 p-4 pop-edge" aria-labelledby="chore-types">
			<h2 id="chore-types" class="font-bold">Types de tâches</h2>
			{#each data.choreTypeCatalog as choreType, index (choreType.id)}
				{@const choreTypeActionsFormId = `chore-type-actions-${choreType.id}`}
				{@const isLastChoreType = index === data.choreTypeCatalog.length - 1}
				<!-- ↑ ↓ Archiver post this form, so Entrée in the fields below stays Enregistrer. -->
				<form
					id={choreTypeActionsFormId}
					method="POST"
					hidden
					use:enhance={saveWithToast(`${choreType.shortLabel} déplacé`)}
				>
					<input type="hidden" name="id" value={choreType.id} />
				</form>
				<form
					method="POST"
					action="?/updateChoreType"
					class={[
						'space-y-2 border-b-2 border-base-content/15 pb-2 text-sm',
						choreType.isArchived && 'opacity-60'
					]}
					use:enhance={saveWithToast(`${choreType.shortLabel} enregistré`)}
				>
					<input type="hidden" name="id" value={choreType.id} />
					<ChoreTypeFields {choreType}>
						{#snippet afterShortLabel()}
							<button
								class="btn btn-square btn-sm"
								form={choreTypeActionsFormId}
								formaction="?/moveChoreTypeUp"
								disabled={index === 0}
								aria-label="Monter {choreType.shortLabel}">↑</button
							>
							<button
								class="btn btn-square btn-sm"
								form={choreTypeActionsFormId}
								formaction="?/moveChoreTypeDown"
								disabled={isLastChoreType}
								aria-label="Descendre {choreType.shortLabel}">↓</button
							>
						{/snippet}
						{#snippet afterFullLabel()}
							<button class="btn btn-sm">Enregistrer</button>
							<button
								class="btn w-24 btn-sm"
								form={choreTypeActionsFormId}
								formaction={choreType.isArchived ? '?/restoreChoreType' : '?/archiveChoreType'}
								data-success-message={choreType.isArchived
									? `${choreType.shortLabel} restauré`
									: `${choreType.shortLabel} archivé`}
								>{choreType.isArchived ? 'Restaurer' : 'Archiver'}</button
							>
						{/snippet}
					</ChoreTypeFields>
				</form>
			{/each}

			<form
				method="POST"
				action="?/addChoreType"
				class="space-y-2 pt-1 text-sm"
				use:enhance={saveWithToast('Type ajouté', { reset: true })}
			>
				<h3 class="font-semibold">Ajouter un type</h3>
				<ChoreTypeFields>
					{#snippet afterFullLabel()}
						<button class="btn btn-primary btn-sm">Ajouter</button>
					{/snippet}
				</ChoreTypeFields>
			</form>
		</section>
	{/if}
</div>
