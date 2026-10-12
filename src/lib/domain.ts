// Domain types shared by the server and the pages.

export const USER_ROLES = ['admin', 'parent', 'child'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** The 8 personal colours (spec Q10, keys and order from prototypes/02-screens.html). */
export const COLOUR_KEYS = [
	'tomato',
	'tangerine',
	'mustard',
	'sage',
	'turquoise',
	'cornflower',
	'lavender',
	'raspberry'
] as const;
export type ColourKey = (typeof COLOUR_KEYS)[number];

/** The active `users` row behind a request (spec Q20 point 4). */
export type Viewer = { id: string; role: UserRole; name: string; colourKey: ColourKey };

/** Just what the access policy needs to know about a person. */
export type PersonRef = { id: string; role: UserRole };
