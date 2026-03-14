import type { PageServerLoad } from './$types';
import { getServiceClient } from '$lib/supabase-service.server';
import { studentSort } from '$lib/subject-sorting';
import type { PreferentialRound, DivisionConfig, Subject } from '$lib/subject-sorting';

export const load: PageServerLoad = async () => {
	const supabase = getServiceClient();

	const [prefRoundRes, divConfigRes, subjectsRes, subjectNamesRes] = await Promise.all([
		supabase.from('preferential_round').select('student_id, subject_id, subject_order'),
		supabase.from('division_config').select('target_year, column_label, subject_type'),
		supabase.from('subjects').select('id, target_grade, subject_type, teacher_id'),
		supabase.from('subjects').select('id, name')
	]);

	if (prefRoundRes.error) throw new Error(`preferential_round: ${prefRoundRes.error.message}`);
	if (divConfigRes.error) throw new Error(`division_config: ${divConfigRes.error.message}`);
	if (subjectsRes.error) throw new Error(`subjects: ${subjectsRes.error.message}`);
	if (subjectNamesRes.error) throw new Error(`subject names: ${subjectNamesRes.error.message}`);

	const result = studentSort(
		prefRoundRes.data as PreferentialRound[],
		divConfigRes.data as DivisionConfig[],
		subjectsRes.data as Subject[]
	);

	// build subject name lookup for UI display
	const subjectNames: Record<string, string> = {};
	for (const s of subjectNamesRes.data) {
		subjectNames[s.id] = s.name;
	}

	return { ...result, subjectNames };
};
