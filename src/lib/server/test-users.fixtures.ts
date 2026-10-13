import type { User } from '../domain';

export const papa: User = { id: 'papa', role: 'admin', name: 'Papa', colourKey: 'cornflower' };
export const maman: User = { id: 'maman', role: 'parent', name: 'Maman', colourKey: 'raspberry' };
export const lea: User = { id: 'lea', role: 'child', name: 'Léa', colourKey: 'turquoise' };
export const noe: User = { id: 'noe', role: 'child', name: 'Noé', colourKey: 'mustard' };
export const allUsers = [papa, maman, lea, noe];
