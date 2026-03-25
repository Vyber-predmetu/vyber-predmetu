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
		supabase.from('subjects').select('id, target_grade, subject_type, teacher_id').eq('state', 'accepted'),
		supabase.from('subjects').select('id, name').eq('state', 'accepted')
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

	// Build subject lookup for type and grade
	const subjectLookup = new Map<string, { subject_type: string; target_grade: number }>();
	for (const s of subjectsRes.data) {
		subjectLookup.set(s.id, { subject_type: s.subject_type, target_grade: s.target_grade });
	}

	// Save column assignments to subject_division table
	// Clear existing data first
	const { error: deleteError } = await supabase
		.from('subject_division')
		.delete()
		.gte('id', '00000000-0000-0000-0000-000000000000');
	if (deleteError)
		return json({ error: `Chyba při mazání: ${deleteError.message}` }, { status: 500 });

	// Build rows to insert (subject_division only has subject_id + column_label)
	const rows: { subject_id: string; column_label: string }[] = [];
	for (const [columnKey, subjects] of Object.entries(result.columns)) {
		const parts = columnKey.split('_');
		const columnLabel = parts.pop()!;

		for (const s of subjects) {
			rows.push({
				subject_id: s.subject_id,
				column_label: columnLabel
			});
		}
	}

	if (rows.length > 0) {
		const { error: insertError } = await supabase.from('subject_division').insert(rows);
		if (insertError)
			return json({ error: `Chyba při ukládání: ${insertError.message}` }, { status: 500 });
	}

	const subjectNames: Record<string, string> = {};
	for (const s of subjectNamesRes.data) {
		subjectNames[s.id] = s.name;
	}

	// Compute multi-column categories from division_config
	const categoryCols = new Map<string, string[]>();
	for (const dc of divConfigRes.data) {
		const cat = `${dc.subject_type}_${dc.target_year}`;
		if (!categoryCols.has(cat)) categoryCols.set(cat, []);
		categoryCols.get(cat)!.push(dc.column_label);
	}
	const multiColumnCategories: Record<string, string[]> = {};
	for (const [cat, labels] of categoryCols) {
		if (labels.length > 1) {
			multiColumnCategories[cat] = labels;
		}
	}

	return json({ ...result, subjectNames, multiColumnCategories });
};

// PATCH: manually move a subject to a different column
export const PATCH: RequestHandler = async ({ request }) => {
	const supabase = getServiceClient();
	const { subject_id, new_column_label } = await request.json();

	if (!subject_id || !new_column_label) {
		return json({ error: 'Chybí subject_id nebo new_column_label' }, { status: 400 });
	}

	const { error } = await supabase
		.from('subject_division')
		.update({ column_label: new_column_label })
		.eq('subject_id', subject_id);

	if (error) return json({ error: error.message }, { status: 500 });

	return json({ ok: true });
};

// GET: load current division from DB + recompute ranking from votes
export const GET: RequestHandler = async () => {
	const supabase = getServiceClient();

	const [divisionRes, subjectNamesRes, divConfigRes, subjectsMetaRes, prefRoundRes] =
		await Promise.all([
			supabase.from('subject_division').select('subject_id, column_label'),
			supabase.from('subjects').select('id, name').eq('state', 'accepted'),
			supabase.from('division_config').select('target_year, column_label, subject_type'),
			supabase.from('subjects').select('id, subject_type, target_grade').eq('state', 'accepted'),
			supabase.from('preferential_round').select('student_id, subject_id, subject_order')
		]);

	if (divisionRes.error) return json({ error: divisionRes.error.message }, { status: 500 });
	if (subjectNamesRes.error) return json({ error: subjectNamesRes.error.message }, { status: 500 });
	if (divConfigRes.error) return json({ error: divConfigRes.error.message }, { status: 500 });
	if (subjectsMetaRes.error) return json({ error: subjectsMetaRes.error.message }, { status: 500 });
	if (prefRoundRes.error) return json({ error: prefRoundRes.error.message }, { status: 500 });

	// If no division data saved yet, return empty
	if (!divisionRes.data.length) {
		return json({ empty: true });
	}

	const subjectNames: Record<string, string> = {};
	for (const s of subjectNamesRes.data) {
		subjectNames[s.id] = s.name;
	}

	// Build subject → category lookup
	const subjectMeta = new Map<string, { subject_type: string; target_grade: number }>();
	for (const s of subjectsMetaRes.data) {
		subjectMeta.set(s.id, { subject_type: s.subject_type, target_grade: s.target_grade });
	}

	// Recompute ranking scores from preferential_round
	const { countSubjectsPerCategory, getCategoryKey } = await import('$lib/subject-sorting');
	const subjectCounts = countSubjectsPerCategory(subjectsMetaRes.data as Subject[]);

	const subjectCategory = new Map<string, string>();
	for (const s of subjectsMetaRes.data) {
		subjectCategory.set(s.id, getCategoryKey(s.subject_type, s.target_grade));
	}

	const scores = new Map<string, Map<string, number>>();
	for (const s of subjectsMetaRes.data) {
		const key = subjectCategory.get(s.id)!;
		if (!scores.has(key)) scores.set(key, new Map());
		scores.get(key)!.set(s.id, 0);
	}

	for (const vote of prefRoundRes.data) {
		const category = subjectCategory.get(vote.subject_id);
		if (!category) continue;
		const n = subjectCounts.get(category) ?? 0;
		const points = n - vote.subject_order + 1;
		const catScores = scores.get(category)!;
		catScores.set(vote.subject_id, (catScores.get(vote.subject_id) ?? 0) + points);
	}

	const ranking: Record<string, Array<{ subject_id: string; points: number }>> = {};
	for (const [category, catScores] of scores) {
		ranking[category] = [...catScores.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([subject_id, points]) => ({ subject_id, points }));
	}

	// Reconstruct columns structure from DB rows (with points from ranking)
	const scoresBySubject = new Map<string, number>();
	for (const [, catScores] of scores) {
		for (const [sid, pts] of catScores) {
			scoresBySubject.set(sid, pts);
		}
	}

	const columns: Record<string, Array<{ subject_id: string; points: number }>> = {};
	for (const row of divisionRes.data) {
		const meta = subjectMeta.get(row.subject_id);
		if (!meta) continue;
		const key = `${meta.subject_type}_${meta.target_grade}_${row.column_label}`;
		if (!columns[key]) columns[key] = [];
		columns[key].push({
			subject_id: row.subject_id,
			points: scoresBySubject.get(row.subject_id) ?? 0
		});
	}

	// Sort each column by points descending
	for (const key of Object.keys(columns)) {
		columns[key].sort((a, b) => b.points - a.points);
	}

	// Figure out which categories have multiple columns
	const categoryCols = new Map<string, string[]>();
	for (const dc of divConfigRes.data) {
		const cat = `${dc.subject_type}_${dc.target_year}`;
		if (!categoryCols.has(cat)) categoryCols.set(cat, []);
		categoryCols.get(cat)!.push(dc.column_label);
	}

	const multiColumnCategories: Record<string, string[]> = {};
	for (const [cat, labels] of categoryCols) {
		if (labels.length > 1) {
			multiColumnCategories[cat] = labels;
		}
	}

	return json({ ranking, columns, multiColumnCategories, subjectNames });
};
