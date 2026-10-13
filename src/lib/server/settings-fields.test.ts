import { describe, expect, it } from 'vitest';
import {
	isSingleEmoji,
	parseChoreTypeDetails,
	parseNewUser,
	parsePersonDetails
} from './settings-fields';

describe('parsePersonDetails', () => {
	it('trims the name and keeps a palette colour', () => {
		expect(parsePersonDetails({ name: '  Léa ', colourKey: 'sage' })).toEqual({
			name: 'Léa',
			colourKey: 'sage'
		});
	});

	it.each([
		[{ name: '   ', colourKey: 'sage' }, 'Prénom manquant'],
		[{ name: 'x'.repeat(31), colourKey: 'sage' }, 'Prénom trop long (30 caractères au plus)'],
		[{ name: 'Léa', colourKey: 'pink' }, 'Couleur inconnue'],
		[{ colourKey: 'sage' }, 'Prénom manquant']
	])('refuses %o: %s', (fields, message) => {
		expect(parsePersonDetails(fields)).toBe(message);
	});
});

describe('parseNewUser', () => {
	it('lowercases the email and checks the role', () => {
		expect(
			parseNewUser({
				email: ' Noe@Exemple.FR ',
				name: 'Noé',
				role: 'child',
				colourKey: 'mustard'
			})
		).toEqual({ email: 'noe@exemple.fr', name: 'Noé', role: 'child', colourKey: 'mustard' });
	});

	it.each([
		[{ email: 'noe', name: 'Noé', role: 'child', colourKey: 'mustard' }, 'Adresse e-mail invalide'],
		[
			{ email: 'a b@c.fr', name: 'Noé', role: 'child', colourKey: 'mustard' },
			'Adresse e-mail invalide'
		],
		[{ email: 'noe@exemple.fr', name: 'Noé', role: 'boss', colourKey: 'mustard' }, 'Rôle inconnu'],
		[{ email: 'noe@exemple.fr', name: '', role: 'child', colourKey: 'mustard' }, 'Prénom manquant']
	])('refuses %o: %s', (fields, message) => {
		expect(parseNewUser(fields)).toBe(message);
	});
});

describe('isSingleEmoji', () => {
	it.each(['🍽️', '🧽', '👨‍👩‍👧', '🇫🇷', '1️⃣', '❤️'])('takes %s', (text) => {
		expect(isSingleEmoji(text)).toBe(true);
	});
	it.each(['', 'a', '🧽🧽', '🧽a', ':)'])('refuses %o', (text) => {
		expect(isSingleEmoji(text)).toBe(false);
	});
});

describe('parseChoreTypeDetails', () => {
	it('trims, and takes the short label as the full one when it is left blank', () => {
		expect(parseChoreTypeDetails({ icon: ' 🧽 ', shortLabel: ' Éponge ', fullLabel: ' ' })).toEqual(
			{
				icon: '🧽',
				shortLabel: 'Éponge',
				fullLabel: 'Éponge'
			}
		);
	});

	it.each([
		[{ icon: 'x', shortLabel: 'Éponge' }, 'Icône invalide : un seul emoji'],
		[{ icon: '🧽', shortLabel: '' }, 'Libellé court manquant'],
		[{ icon: '🧽', shortLabel: 'x'.repeat(21) }, 'Libellé court trop long (20 caractères au plus)'],
		[
			{ icon: '🧽', shortLabel: 'Éponge', fullLabel: 'x'.repeat(61) },
			'Libellé complet trop long (60 caractères au plus)'
		]
	])('refuses %o: %s', (fields, message) => {
		expect(parseChoreTypeDetails(fields)).toBe(message);
	});
});
