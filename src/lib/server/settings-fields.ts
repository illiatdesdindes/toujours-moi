// Réglages' form fields (spec Q10): each parser returns the clean fields, or the French reason it
// refuses them.
import { COLOUR_KEYS, USER_ROLES, type ColourKey, type UserRole } from '../domain';

type FormFields = Record<string, unknown>;

const MAX_PERSON_NAME_LENGTH = 30;
const MAX_SHORT_LABEL_LENGTH = 20;
const MAX_FULL_LABEL_LENGTH = 60;

const trimmed = (fieldValue: unknown) => (typeof fieldValue === 'string' ? fieldValue.trim() : '');
const tooLong = (what: string, maxLength: number) =>
	`${what} trop long (${maxLength} caractères au plus)`;

/** Mon profil, Enfants and Membres: a prénom and a palette colour. */
export const parsePersonDetails = (
	fields: FormFields
): { name: string; colourKey: ColourKey } | string => {
	const name = trimmed(fields.name);
	if (!name) return 'Prénom manquant';
	if (name.length > MAX_PERSON_NAME_LENGTH) return tooLong('Prénom', MAX_PERSON_NAME_LENGTH);
	const colourKey = fields.colourKey as ColourKey;
	if (!COLOUR_KEYS.includes(colourKey)) return 'Couleur inconnue';
	return { name, colourKey };
};

export const parseRole = (fieldValue: unknown): UserRole | null =>
	USER_ROLES.includes(fieldValue as UserRole) ? (fieldValue as UserRole) : null;

/** Membres' Ajouter: the email (lowercased, as `users` stores it), prénom, role and colour. */
export const parseNewUser = (fields: FormFields) => {
	const email = trimmed(fields.email).toLowerCase();
	// ponytail: a shape check only; Cloudflare Access is what proves the address.
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return 'Adresse e-mail invalide';
	const role = parseRole(fields.role);
	if (!role) return 'Rôle inconnu';
	const details = parsePersonDetails(fields);
	if (typeof details === 'string') return details;
	return { email, role, ...details };
};

/** One grapheme that is an emoji (spec Q4: chore type icons are emoji): 🧽, 👨‍👩‍👧, 🇫🇷, 1️⃣. */
export const isSingleEmoji = (text: string) => {
	const graphemes = [...new Intl.Segmenter().segment(text)];
	return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(text);
};

/** Types de tâches: an emoji and the two labels; a blank full label is the short one. */
export const parseChoreTypeLabels = (
	fields: FormFields
): { icon: string; shortLabel: string; fullLabel: string } | string => {
	const icon = trimmed(fields.icon);
	if (!isSingleEmoji(icon)) return 'Icône invalide : un seul emoji';
	const shortLabel = trimmed(fields.shortLabel);
	if (!shortLabel) return 'Libellé court manquant';
	if (shortLabel.length > MAX_SHORT_LABEL_LENGTH)
		return tooLong('Libellé court', MAX_SHORT_LABEL_LENGTH);
	const fullLabel = trimmed(fields.fullLabel) || shortLabel;
	if (fullLabel.length > MAX_FULL_LABEL_LENGTH)
		return tooLong('Libellé complet', MAX_FULL_LABEL_LENGTH);
	return { icon, shortLabel, fullLabel };
};
