// Rapports (spec Q9): the SQL aggregates of a period, per profile, and the page.
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelectedProfile, User } from '../src/lib/domain';
import { saveWithVersion } from '../src/lib/server/record-versions';
import { loadReportStats } from '../src/lib/server/report-stats';
import { reportPeriodFor } from '../src/lib/report-periods';
import { uuidV7 } from '../src/lib/uuid';
import {
	ADMIN_ID,
	CHILD_ID,
	PARENT_ID,
	resetFamily,
	SECOND_CHILD_ID,
	seedFamily
} from './test-family';
import { accessHeaders, fetchPage, stubOutboundFetch } from './worker-requests';

const DISHES_ID = '01900000-0000-7000-a000-000000000001';
const COOKING_ID = '01900000-0000-7000-a000-000000000002';
const NOW = new Date('2026-10-13T20:00:00Z');
// Monday 5 to Sunday 11 Oct 2026, Paris (UTC+2).
const WEEK = reportPeriodFor('week', '2026-10-05', NOW);

const seedChore = async (
	performerId: string,
	startedAt: string,
	durationMinutes: number,
	choreTypeId = DISHES_ID
) => {
	const choreId = uuidV7();
	await saveWithVersion(
		env.DB,
		'chores',
		choreId,
		{
			chore_type_id: choreTypeId,
			duration_minutes: durationMinutes,
			started_at: startedAt,
			performer_user_id: performerId,
			author_user_id: performerId,
			note: null
		},
		performerId
	);
	return choreId;
};

const lea = { id: CHILD_ID, role: 'child', name: 'Léa', colourKey: 'turquoise' } satisfies User;
const leaProfile: SelectedProfile = { kind: 'person', person: lea };
const familyProfile: SelectedProfile = { kind: 'family' };

describe('loadReportStats', () => {
	beforeEach(async () => {
		await resetFamily();
		await seedFamily();
		// Monday 5 Oct, 10:00 Paris.
		await seedChore(CHILD_ID, '2026-10-05T08:00:00.000Z', 45);
		// Sunday 11 Oct, 23:30 Paris, ends after midnight: still Sunday's (its start).
		await seedChore(CHILD_ID, '2026-10-11T21:30:00.000Z', 30, COOKING_ID);
		// Monday 12 Oct, 00:15 Paris: the next week.
		await seedChore(CHILD_ID, '2026-10-11T22:15:00.000Z', 120);
		// Wednesday 7 Oct, Noé.
		await seedChore(SECOND_CHILD_ID, '2026-10-07T16:00:00.000Z', 60);
		// The week before: Maman, then Léa.
		await seedChore(PARENT_ID, '2026-10-01T10:00:00.000Z', 90, COOKING_ID);
		await seedChore(CHILD_ID, '2026-10-04T21:45:00.000Z', 15); // Sunday 4 Oct, 23:45 Paris
		// Deleted: left out everywhere.
		const deletedId = await seedChore(CHILD_ID, '2026-10-06T08:00:00.000Z', 600);
		await saveWithVersion(
			env.DB,
			'chores',
			deletedId,
			{ deleted_at: NOW.toISOString(), deleted_by_user_id: CHILD_ID },
			CHILD_ID
		);
	});

	it("sums one person's period by start time, against the previous period", async () => {
		const stats = await loadReportStats(env.DB, leaProfile, WEEK);
		expect(stats).toMatchObject({ totalMinutes: 75, choreCount: 2, previousTotalMinutes: 15 });
		expect(stats.byType).toEqual([
			expect.objectContaining({
				choreTypeId: DISHES_ID,
				icon: '🍽️',
				minutes: 45,
				count: 1,
				percent: 60
			}),
			expect.objectContaining({
				choreTypeId: COOKING_ID,
				shortLabel: 'Repas',
				minutes: 30,
				count: 1,
				percent: 40
			})
		]);
		expect(stats.bucketTotals.map((bucket) => bucket.totalMinutes)).toEqual([
			45, 0, 0, 0, 0, 0, 30
		]);
		expect(stats.bucketTotals[0]!.segments).toEqual([
			{ userId: CHILD_ID, colourKey: 'turquoise', minutes: 45 }
		]);
	});

	it('sums the household for Famille, with a per-person split', async () => {
		const stats = await loadReportStats(env.DB, familyProfile, WEEK);
		expect(stats).toMatchObject({ totalMinutes: 135, choreCount: 3, previousTotalMinutes: 105 });
		expect(stats.byPerson).toEqual([
			{ userId: CHILD_ID, name: 'Léa', colourKey: 'turquoise', minutes: 75, count: 2, percent: 56 },
			{
				userId: SECOND_CHILD_ID,
				name: 'Noé',
				colourKey: 'mustard',
				minutes: 60,
				count: 1,
				percent: 44
			}
		]);
		expect(stats.bucketTotals[2]!.segments).toEqual([
			{ userId: SECOND_CHILD_ID, colourKey: 'mustard', minutes: 60 }
		]);
	});

	it('is empty, with a zero percent, on a period without chores', async () => {
		const stats = await loadReportStats(
			env.DB,
			familyProfile,
			reportPeriodFor('day', '2026-10-09', NOW)
		);
		expect(stats).toEqual({
			totalMinutes: 0,
			choreCount: 0,
			previousTotalMinutes: 0,
			byType: [],
			byPerson: [],
			bucketTotals: []
		});
	});

	it('buckets a year by Paris month', async () => {
		const stats = await loadReportStats(
			env.DB,
			familyProfile,
			reportPeriodFor('year', '2026-10-05', NOW)
		);
		expect(stats.totalMinutes).toBe(45 + 30 + 120 + 60 + 90 + 15);
		expect(stats.bucketTotals.map((bucket) => bucket.totalMinutes)).toEqual([
			0, 0, 0, 0, 0, 0, 0, 0, 0, 360, 0, 0
		]);
	});
});

describe('/rapports', () => {
	beforeEach(async () => {
		stubOutboundFetch();
		await resetFamily();
		await seedFamily();
		await seedChore(ADMIN_ID, new Date(Date.now() - 3 * 3_600_000).toISOString(), 45);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('renders the period on the server, with the per-person split only for Famille', async () => {
		const headers = await accessHeaders('papa@exemple.fr');
		const mine = await (await fetchPage('/rapports?periode=jour', headers)).text();
		expect(mine).toContain('Par type');
		expect(mine).toContain('45 min');
		expect(mine).not.toContain('Par personne');
		const family = await (
			await fetchPage('/rapports?profil=famille&periode=annee', headers)
		).text();
		expect(family).toContain('Par personne');
	});

	it('keeps a child to their own report', async () => {
		const headers = await accessHeaders('lea@exemple.fr');
		expect((await fetchPage(`/rapports?profil=${ADMIN_ID}`, headers)).status).toBe(403);
		expect((await fetchPage('/rapports?profil=famille', headers)).status).toBe(403);
		expect((await fetchPage('/rapports', headers)).status).toBe(200);
	});
});
