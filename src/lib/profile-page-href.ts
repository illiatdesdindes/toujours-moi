// Spec Q8: the profile pages carry `?profil=` (left out = yourself). One way to build their links,
// for the tabs, the profile switcher and Rapports' own links.
import { resolve } from '$app/paths';

export type ProfilePageRouteId = '/' | '/historique' | '/rapports';

/** `routeId` with `?profil=<profileParam>` and the page's own params (Rapports' `?periode=&date=`); a `profil` among them is replaced. */
export const profilePageHref = (
	routeId: ProfilePageRouteId,
	profileParam: string | null,
	pageParams: Iterable<[string, string]> = []
) => {
	const query = new URLSearchParams([...pageParams].filter(([param]) => param !== 'profil'));
	if (profileParam) query.set('profil', profileParam);
	return query.size ? resolve(`${routeId}?${query}`) : resolve(routeId);
};
