import { getServiceClient } from '$lib/supabase-service.server';
import * as XLSX from 'xlsx';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const supabase = getServiceClient();

	const [enrollmentRes, subjectsRes, studentsRes, divisionRes, divConfigRes] = await Promise.all([
		supabase.from('student_enrollment').select('student_id, subject_id, target_year, subject_type'),
		supabase
			.from('subjects')
			.select('id, name, target_grade, subject_type')
			.eq('state', 'accepted'),
		supabase.from('users').select('id, first_name, last_name'),
		supabase.from('subject_division').select('subject_id, column_label'),
		supabase.from('division_config').select('target_year, column_label, subject_type')
	]);

	if (
		enrollmentRes.error ||
		subjectsRes.error ||
		studentsRes.error ||
		divisionRes.error ||
		divConfigRes.error
	) {
		return new Response('Chyba při načítání dat', { status: 500 });
	}

	if (!enrollmentRes.data.length) {
		return new Response('Žádná zařazení k exportu', { status: 404 });
	}

	// Build lookups
	const subjectNames: Record<string, string> = {};
	const subjectMeta: Record<string, { subject_type: string; target_grade: number }> = {};
	for (const s of subjectsRes.data) {
		subjectNames[s.id] = s.name;
		subjectMeta[s.id] = { subject_type: s.subject_type, target_grade: s.target_grade };
	}

	const studentNames: Record<string, string> = {};
	for (const u of studentsRes.data) {
		studentNames[u.id] = `${u.first_name} ${u.last_name}`;
	}

	const subjectColumns: Record<string, string> = {};
	for (const row of divisionRes.data) {
		subjectColumns[row.subject_id] = row.column_label;
	}

	// Count columns per category to know if we need column numbers
	const catColumnCount: Record<string, number> = {};
	for (const dc of divConfigRes.data) {
		const cat = `${dc.subject_type}_${dc.target_year}`;
		catColumnCount[cat] = (catColumnCount[cat] ?? 0) + 1;
	}

	// Build category label like "OSE-2.ročník" or "OSE1-3.ročník"
	function categoryLabel(subjectType: string, targetYear: number, columnLabel?: string): string {
		const cat = `${subjectType}_${targetYear}`;
		const isMulti = (catColumnCount[cat] ?? 1) > 1;
		const colNum = columnLabel ? columnLabel.charCodeAt(0) - 64 : 0;
		const suffix = isMulti && colNum > 0 ? `${colNum}` : '';
		return `${subjectType}${suffix}-${targetYear}.ročník`;
	}

	// Group: category → subject_id[] (ordered)
	// Then for each subject: student names
	type CategoryData = {
		label: string;
		subjects: { name: string; students: string[] }[];
	};

	// Group enrollments by category+column → subject → students
	const catSubjectStudents = new Map<string, Map<string, string[]>>();
	const catLabels = new Map<string, string>();

	for (const e of enrollmentRes.data) {
		const meta = subjectMeta[e.subject_id];
		if (!meta) continue;
		const col = subjectColumns[e.subject_id];
		const label = categoryLabel(meta.subject_type, meta.target_grade, col);
		const key = label; // use the display label as grouping key

		if (!catLabels.has(key)) catLabels.set(key, label);
		if (!catSubjectStudents.has(key)) catSubjectStudents.set(key, new Map());

		const subjectMap = catSubjectStudents.get(key)!;
		const subjectName = subjectNames[e.subject_id] ?? e.subject_id;
		if (!subjectMap.has(subjectName)) subjectMap.set(subjectName, []);
		subjectMap.get(subjectName)!.push(studentNames[e.student_id] ?? e.student_id);
	}

	// Build Excel workbook — one sheet per category
	const wb = XLSX.utils.book_new();

	const sortedCategories = [...catSubjectStudents.keys()].sort();

	for (const catKey of sortedCategories) {
		const subjectMap = catSubjectStudents.get(catKey)!;
		const rows: (string | null)[][] = [];

		for (const [subjectName, students] of subjectMap) {
			// Subject header
			rows.push([subjectName]);
			// Student list
			for (const student of students.sort()) {
				rows.push([null, student]);
			}
			rows.push([]); // blank row between subjects
		}

		const ws = XLSX.utils.aoa_to_sheet(rows);
		ws['!cols'] = [{ wch: 30 }, { wch: 30 }];

		// Sheet name max 31 chars in Excel
		const sheetName = catKey.length > 31 ? catKey.slice(0, 31) : catKey;
		XLSX.utils.book_append_sheet(wb, ws, sheetName);
	}

	const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': 'attachment; filename="zarazeni-studentu.xlsx"'
		}
	});
};
