import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceClient } from '$lib/supabase-service.server';
import { studentSort } from '$lib/subject-sorting';
import type { PreferentialRound, DivisionConfig, Subject } from '$lib/subject-sorting';

export const POST: RequestHandler = async () => {
	const supabase = getServiceClient();

	const [prefRoundRes, divConfigRes, subjectsRes, subjectNamesRes] = await Promise.all([
		supabase.from('preferential_round').select('student_id, subject_id, subject_order'),
		supabase.from('division_config').select('target_year, column_label, subject_type'),
		supabase.from('subjects').select('id, target_grade, subject_type, teacher_id'),
		supabase.from('subjects').select('id, name')
	]);

	if (prefRoundRes.error) return json({ error: prefRoundRes.error.message }, { status: 500 });
	if (divConfigRes.error) return json({ error: divConfigRes.error.message }, { status: 500 });
	if (subjectsRes.error) return json({ error: subjectsRes.error.message }, { status: 500 });
	if (subjectNamesRes.error) return json({ error: subjectNamesRes.error.message }, { status: 500 });

	const result = studentSort(
		prefRoundRes.data as PreferentialRound[],
		divConfigRes.data as DivisionConfig[],
		subjectsRes.data as Subject[]
	);

	const subjectNames: Record<string, string> = {};
	for (const s of subjectNamesRes.data) {
		subjectNames[s.id] = s.name;
	}

	return json({ ...result, subjectNames });
};
