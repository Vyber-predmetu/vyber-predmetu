import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceClient } from '$lib/supabase-service.server';
import { enrollStudents, getCategoryKey } from '$lib/subject-sorting';
import type {
	PreferentialRound,
	DivisionConfig,
	Subject,
	SortedSubject
} from '$lib/subject-sorting';

export const POST: RequestHandler = async () => {
	const supabase = getServiceClient();

	// Fetch all needed data in parallel
	const [divisionRes, prefRoundRes, subjectsRes, divConfigRes, studentsRes] = await Promise.all([
		supabase.from('subject_division').select('subject_id, column_label'),
		supabase.from('preferential_round').select('student_id, subject_id, subject_order'),
		supabase
			.from('subjects')
			.select('id, target_grade, subject_type, teacher_id, name')
			.eq('state', 'accepted'),
		supabase.from('division_config').select('target_year, column_label, subject_type'),
		supabase.from('users').select('id, first_name, last_name')
	]);

	if (divisionRes.error) return json({ error: divisionRes.error.message }, { status: 500 });
	if (prefRoundRes.error) return json({ error: prefRoundRes.error.message }, { status: 500 });
	if (subjectsRes.error) return json({ error: subjectsRes.error.message }, { status: 500 });
	if (divConfigRes.error) return json({ error: divConfigRes.error.message }, { status: 500 });
	if (studentsRes.error) return json({ error: studentsRes.error.message }, { status: 500 });

	if (!divisionRes.data.length) {
		return json(
			{ error: 'Nejdříve musíte spustit rozdělení předmětů do sloupců.' },
			{ status: 400 }
		);
	}

	if (!prefRoundRes.data.length) {
		return json({ error: 'Žádné hlasy v preferenčním kole.' }, { status: 400 });
	}

	// Reconstruct columns from subject_division + subjects metadata
	const subjectMeta = new Map<string, { subject_type: string; target_grade: number }>();
	for (const s of subjectsRes.data) {
		subjectMeta.set(s.id, { subject_type: s.subject_type, target_grade: s.target_grade });
	}

	const columns: Record<string, SortedSubject[]> = {};
	for (const row of divisionRes.data) {
		const meta = subjectMeta.get(row.subject_id);
		if (!meta) continue;
		const key = `${getCategoryKey(meta.subject_type, meta.target_grade)}_${row.column_label}`;
		if (!columns[key]) columns[key] = [];
		columns[key].push({ subject_id: row.subject_id, points: 0 });
	}

	// Run enrollment algorithm
	const enrollments = enrollStudents(
		columns,
		prefRoundRes.data as PreferentialRound[],
		subjectsRes.data as Subject[],
		divConfigRes.data as DivisionConfig[]
	);

	// Clear existing enrollments
	const { error: deleteError } = await supabase
		.from('student_enrollment')
		.delete()
		.gte('id', '00000000-0000-0000-0000-000000000000');
	if (deleteError)
		return json({ error: `Chyba při mazání: ${deleteError.message}` }, { status: 500 });

	// Insert new enrollments
	if (enrollments.length > 0) {
		const { error: insertError } = await supabase.from('student_enrollment').insert(enrollments);
		if (insertError)
			return json({ error: `Chyba při ukládání: ${insertError.message}` }, { status: 500 });
	}

	// Build subject name lookup for the response
	const subjectNames: Record<string, string> = {};
	for (const s of subjectsRes.data) {
		subjectNames[s.id] = s.name;
	}

	// Build student name lookup
	const studentNames: Record<string, string> = {};
	for (const u of studentsRes.data) {
		studentNames[u.id] = `${u.first_name} ${u.last_name}`;
	}

	// Build subject → column label mapping from subject_division
	const subjectColumns: Record<string, string> = {};
	for (const row of divisionRes.data) {
		subjectColumns[row.subject_id] = row.column_label;
	}

	// Build multi-column categories from division_config
	const catCols = new Map<string, string[]>();
	for (const dc of divConfigRes.data) {
		const cat = `${dc.subject_type}_${dc.target_year}`;
		if (!catCols.has(cat)) catCols.set(cat, []);
		catCols.get(cat)!.push(dc.column_label);
	}
	const multiColumnCategories: Record<string, string[]> = {};
	for (const [cat, labels] of catCols) {
		if (labels.length > 1) {
			multiColumnCategories[cat] = labels.sort();
		}
	}

	return json({
		count: enrollments.length,
		enrollments,
		subjectNames,
		studentNames,
		subjectColumns,
		multiColumnCategories
	});
};

// GET: load saved enrollments from DB
export const GET: RequestHandler = async () => {
	const supabase = getServiceClient();

	const [enrollmentRes, subjectsRes, studentsRes, divisionRes, divConfigRes] = await Promise.all([
		supabase.from('student_enrollment').select('student_id, subject_id, target_year, subject_type'),
		supabase.from('subjects').select('id, name').eq('state', 'accepted'),
		supabase.from('users').select('id, first_name, last_name'),
		supabase.from('subject_division').select('subject_id, column_label'),
		supabase.from('division_config').select('target_year, column_label, subject_type')
	]);

	if (enrollmentRes.error) return json({ error: enrollmentRes.error.message }, { status: 500 });
	if (subjectsRes.error) return json({ error: subjectsRes.error.message }, { status: 500 });
	if (studentsRes.error) return json({ error: studentsRes.error.message }, { status: 500 });
	if (divisionRes.error) return json({ error: divisionRes.error.message }, { status: 500 });
	if (divConfigRes.error) return json({ error: divConfigRes.error.message }, { status: 500 });

	if (!enrollmentRes.data.length) {
		return json({ empty: true });
	}

	const subjectNames: Record<string, string> = {};
	for (const s of subjectsRes.data) {
		subjectNames[s.id] = s.name;
	}

	const studentNames: Record<string, string> = {};
	for (const u of studentsRes.data) {
		studentNames[u.id] = `${u.first_name} ${u.last_name}`;
	}

	// Build subject → column label mapping
	const subjectColumns: Record<string, string> = {};
	for (const row of divisionRes.data) {
		subjectColumns[row.subject_id] = row.column_label;
	}

	// Build multi-column categories from division_config
	const catCols = new Map<string, string[]>();
	for (const dc of divConfigRes.data) {
		const cat = `${dc.subject_type}_${dc.target_year}`;
		if (!catCols.has(cat)) catCols.set(cat, []);
		catCols.get(cat)!.push(dc.column_label);
	}
	const multiColumnCategories: Record<string, string[]> = {};
	for (const [cat, labels] of catCols) {
		if (labels.length > 1) {
			multiColumnCategories[cat] = labels.sort();
		}
	}

	return json({
		count: enrollmentRes.data.length,
		enrollments: enrollmentRes.data,
		subjectNames,
		studentNames,
		subjectColumns,
		multiColumnCategories
	});
};
