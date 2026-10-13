// Rapports' numbers (spec Q9, Q20 point 6): a period's aggregates, summed in SQL. A chore counts in
// the period of its start (`started_at`); deleted chores never count, deactivated people's and
// archived types' still do (spec Q2, Q10).
import type { ColourKey, ReportStats, SelectedProfile } from '../domain';
import type { ReportPeriod } from '../report-periods';

// ?1 performer (null = Famille), ?2 period start, ?3 period end.
const LIVE_CHORES = `chores.deleted_at IS NULL AND (?1 IS NULL OR performer_user_id = ?1)`;
const IN_PERIOD = `${LIVE_CHORES} AND started_at >= ?2 AND started_at < ?3`;

const percentOf = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export const loadReportStats = async (
	db: D1Database,
	selectedProfile: SelectedProfile,
	period: ReportPeriod
): Promise<ReportStats> => {
	const performerUserId = selectedProfile.kind === 'person' ? selectedProfile.person.id : null;
	const [totals, byType, byPerson, bucketSegments] = await db.batch([
		db
			.prepare(
				`SELECT
					COALESCE(SUM(CASE WHEN started_at >= ?2 THEN duration_minutes END), 0) AS total_minutes,
					COUNT(CASE WHEN started_at >= ?2 THEN 1 END) AS chore_count,
					COALESCE(SUM(CASE WHEN started_at < ?2 THEN duration_minutes END), 0) AS previous_total_minutes
				FROM chores WHERE ${LIVE_CHORES} AND started_at >= ?4 AND started_at < ?3`
			)
			.bind(performerUserId, period.start, period.end, period.previousStart),
		db
			.prepare(
				`SELECT chore_type_id, icon, short_label, full_label,
					SUM(duration_minutes) AS minutes, COUNT(*) AS chore_count
				FROM chores JOIN chore_types ON chore_types.id = chores.chore_type_id
				WHERE ${IN_PERIOD}
				GROUP BY chore_type_id ORDER BY minutes DESC, sort_order`
			)
			.bind(performerUserId, period.start, period.end),
		db
			.prepare(
				`SELECT performer_user_id, name, colour_key,
					SUM(duration_minutes) AS minutes, COUNT(*) AS chore_count
				FROM chores JOIN users ON users.id = chores.performer_user_id
				WHERE ${IN_PERIOD}
				GROUP BY performer_user_id ORDER BY minutes DESC, name`
			)
			.bind(performerUserId, period.start, period.end),
		// The sub-periods come in as one JSON array of [start, end]: no bound-parameter limit.
		db
			.prepare(
				`WITH buckets AS (
					SELECT key AS bucket_index, json_extract(value, '$[0]') AS bucket_start,
						json_extract(value, '$[1]') AS bucket_end
					FROM json_each(?4)
				)
				SELECT bucket_index, performer_user_id, colour_key, SUM(duration_minutes) AS minutes
				FROM buckets
				JOIN chores ON started_at >= bucket_start AND started_at < bucket_end
				JOIN users ON users.id = chores.performer_user_id
				WHERE ${IN_PERIOD}
				GROUP BY bucket_index, performer_user_id ORDER BY bucket_index, performer_user_id`
			)
			.bind(
				performerUserId,
				period.start,
				period.end,
				JSON.stringify(period.buckets.map((bucket) => [bucket.start, bucket.end]))
			)
	]);
	const total = totals!.results[0] as {
		total_minutes: number;
		chore_count: number;
		previous_total_minutes: number;
	};
	const buckets: ReportStats['buckets'] = period.buckets.map(() => ({
		totalMinutes: 0,
		segments: []
	}));
	for (const row of bucketSegments!.results as {
		bucket_index: number;
		performer_user_id: string;
		colour_key: ColourKey;
		minutes: number;
	}[]) {
		const bucket = buckets[row.bucket_index]!;
		bucket.totalMinutes += row.minutes;
		bucket.segments.push({
			userId: row.performer_user_id,
			colourKey: row.colour_key,
			minutes: row.minutes
		});
	}
	return {
		totalMinutes: total.total_minutes,
		choreCount: total.chore_count,
		previousTotalMinutes: total.previous_total_minutes,
		byType: (
			byType!.results as {
				chore_type_id: string;
				icon: string;
				short_label: string;
				full_label: string;
				minutes: number;
				chore_count: number;
			}[]
		).map((row) => ({
			choreTypeId: row.chore_type_id,
			icon: row.icon,
			shortLabel: row.short_label,
			fullLabel: row.full_label,
			minutes: row.minutes,
			count: row.chore_count,
			percent: percentOf(row.minutes, total.total_minutes)
		})),
		byPerson: (
			byPerson!.results as {
				performer_user_id: string;
				name: string;
				colour_key: ColourKey;
				minutes: number;
				chore_count: number;
			}[]
		).map((row) => ({
			userId: row.performer_user_id,
			name: row.name,
			colourKey: row.colour_key,
			minutes: row.minutes,
			count: row.chore_count,
			percent: percentOf(row.minutes, total.total_minutes)
		})),
		buckets
	};
};
