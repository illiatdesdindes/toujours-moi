<!-- Réglages (spec Q10, prototype 02): Mon profil for everyone, Enfants for parents, Membres and Types de tâches for the admin. Every form saves through a form action of this page. -->
<script lang="ts">
	import { getShowToast } from '#lib/app-context.js';
	import PersonColourDot from '#lib/components/PersonColourDot.svelte';
	import PersonalColourPicker from '#lib/components/PersonalColourPicker.svelte';
	import { USER_ROLES, type UserAccount, type UserRole } from '#lib/domain.js';
	import { enhance, type SubmitFunction } from '$app/forms';

	let { data, form } = $props();
	const showToast = getShowToast();

	const ROLE_LABELS: Record<UserRole, string> = {
		admin: 'admin',
		parent: 'parent',
		child: 'enfant'
	};

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

	const activeAdminCount = $derived(
		data.userAccounts?.filter((userAccount) => userAccount.isActive && userAccount.role === 'admin')
			.length ?? 0
	);
	/** Spec Q10: the server refuses it too; the page only greys it out. */
	const isLastActiveAdmin = (userAccount: UserAccount) =>
		userAccount.isActive && userAccount.role === 'admin' && activeAdminCount === 1;
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
				>Prénom<input
					class="input w-full"
					name="name"
					value={data.viewer.name}
					required
					maxlength="30"
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
					<input
						class="input w-32 input-sm"
						name="name"
						value={child.name}
						required
						maxlength="30"
						aria-label="Prénom"
					/>
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
						<input
							class="input w-32 input-sm"
							name="name"
							value={userAccount.name}
							required
							maxlength="30"
							aria-label="Prénom"
						/>
						{#if isLastActiveAdmin(userAccount)}
							<input type="hidden" name="role" value={userAccount.role} />
						{/if}
						<select
							class="select w-28 select-sm"
							name="role"
							aria-label="Rôle"
							disabled={isLastActiveAdmin(userAccount)}
							title={isLastActiveAdmin(userAccount)
								? 'Il faut toujours au moins un admin actif'
								: undefined}
						>
							{#each USER_ROLES as role (role)}
								<option value={role} selected={role === userAccount.role}
									>{ROLE_LABELS[role]}</option
								>
							{/each}
						</select>
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
							disabled={isLastActiveAdmin(userAccount)}
							title={isLastActiveAdmin(userAccount)
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
					<input
						class="input w-full input-sm"
						name="name"
						required
						maxlength="30"
						placeholder="prénom"
						aria-label="Prénom"
						autocomplete="off"
					/>
					<select class="select w-full select-sm" name="role" aria-label="Rôle">
						<option value="parent">parent</option>
						<option value="child" selected>enfant</option>
						<option value="admin">admin</option>
					</select>
				</div>
				<PersonalColourPicker selectedColourKey="sage" size="sm" />
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
					<div class="flex items-center gap-2">
						<input
							class="input w-14 text-center text-lg input-sm"
							name="icon"
							value={choreType.icon}
							required
							aria-label="Icône (un emoji)"
						/>
						<input
							class="input min-w-0 flex-1 input-sm"
							name="shortLabel"
							value={choreType.shortLabel}
							required
							maxlength="20"
							aria-label="Libellé court"
						/>
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
							disabled={index === data.choreTypeCatalog.length - 1}
							aria-label="Descendre {choreType.shortLabel}">↓</button
						>
					</div>
					<div class="flex items-center gap-2">
						<input
							class="input min-w-0 flex-1 input-sm"
							name="fullLabel"
							value={choreType.fullLabel}
							maxlength="60"
							placeholder="libellé complet"
							aria-label="Libellé complet"
						/>
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
					</div>
				</form>
			{/each}

			<form
				method="POST"
				action="?/addChoreType"
				class="space-y-2 pt-1 text-sm"
				use:enhance={saveWithToast('Type ajouté', { reset: true })}
			>
				<h3 class="font-semibold">Ajouter un type</h3>
				<div class="flex items-center gap-2">
					<input
						class="input w-14 text-center text-lg input-sm"
						name="icon"
						required
						placeholder="🧽"
						aria-label="Icône (un emoji)"
					/>
					<input
						class="input min-w-0 flex-1 input-sm"
						name="shortLabel"
						required
						maxlength="20"
						placeholder="libellé court"
						aria-label="Libellé court"
					/>
				</div>
				<div class="flex items-center gap-2">
					<input
						class="input min-w-0 flex-1 input-sm"
						name="fullLabel"
						maxlength="60"
						placeholder="libellé complet (facultatif)"
						aria-label="Libellé complet"
					/>
					<button class="btn btn-primary btn-sm">Ajouter</button>
				</div>
			</form>
		</section>
	{/if}
</div>
