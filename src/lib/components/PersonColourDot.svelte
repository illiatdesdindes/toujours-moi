<!-- A person's colour as a small dot (spec Q8, Q10): the profile switcher, and later Famille rows and charts. The ring takes the text colour, so it stays visible on a selected (navy) menu row. -->
<script lang="ts">
	import { PERSONAL_COLOURS, type ColourKey } from '#lib/domain.js';

	let { colourKey }: { colourKey: ColourKey } = $props();
</script>

<span
	class="inline-block size-3 shrink-0 rounded-full border-2 border-current"
	style:background={PERSONAL_COLOURS[colourKey].background}
	aria-hidden="true"
></span>
