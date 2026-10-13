<!-- The role select (spec Q8, Q10), posting `role`: Membres' rows and Ajouter un membre. Other select attributes pass through. -->
<script lang="ts">
	import { USER_ROLES, type UserRole } from '#lib/domain.js';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	let { selectedRole, ...selectAttributes }: { selectedRole: UserRole } & HTMLSelectAttributes =
		$props();

	const ROLE_LABELS: Record<UserRole, string> = {
		admin: 'admin',
		parent: 'parent',
		child: 'enfant'
	};
</script>

<select name="role" aria-label="Rôle" {...selectAttributes}>
	{#each USER_ROLES as role (role)}
		<option value={role} selected={role === selectedRole}>{ROLE_LABELS[role]}</option>
	{/each}
</select>
