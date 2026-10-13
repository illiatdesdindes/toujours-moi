import { env } from 'cloudflare:workers';
import { loadSelectedProfile } from '#lib/server/profile-selection.js';
import { loadReportStats } from '#lib/server/report-stats.js';
import { readReportPeriodParams, reportPeriodFor } from '#lib/report-periods.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const now = new Date();
	const { kind, date } = readReportPeriodParams(url.searchParams, now);
	const reportPeriod = reportPeriodFor(kind, date, now);
	const { profileHeader } = await loadSelectedProfile(env.DB, locals.viewer, url);
	return {
		...profileHeader,
		reportPeriod,
		reportStats: await loadReportStats(env.DB, profileHeader.selectedProfile, reportPeriod)
	};
};
