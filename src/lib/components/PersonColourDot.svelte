<!-- A person's colour as a small dot (spec Q8, Q10): the profile switcher, and later Famille rows and charts. -->
<script lang="ts">
	import { PERSONAL_COLOURS, type ColourKey } from '#lib/domain.js';

	let { colourKey }: { colourKey: ColourKey } = $props();
</script>

<span
	class="inline-block size-3 shrink-0 rounded-full border-2 border-base-content"
	style:background={PERSONAL_COLOURS[colourKey].background}
	aria-hidden="true"
></span>
