export type PreferentialRound = {
	student_id: string;
	subject_id: string;
	subject_order: number;
};

export type DivisionConfig = {
	target_year: number;
	column_label: string;
	subject_type: string;
};

export type Subject = {
	id: string;
	target_grade: number;
	subject_type: string;
	teacher_id: string;
};

// category key = "OSE_2" | "OSE_3" | "MVOP_3" | "OSE_4"
export type CategoryKey = `${string}_${number}`;

export function getCategoryKey(subjectType: string, targetYear: number): CategoryKey {
	return `${subjectType}_${targetYear}`;
}

export function countSubjectsPerCategory(subjects: Subject[]): Map<CategoryKey, number> {
	const counts = new Map<CategoryKey, number>();
	for (const s of subjects) {
		const key = getCategoryKey(s.subject_type, s.target_grade);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

export function studentSort(
	preferentialRound: PreferentialRound[],
	divisionConfig: DivisionConfig[],
	subjects: Subject[]
) {
	// count subjects per category once
	const subjectCounts = countSubjectsPerCategory(subjects);

	// build lookup: subject_id → category key
	const subjectCategory = new Map<string, CategoryKey>();
	for (const s of subjects) {
		subjectCategory.set(s.id, getCategoryKey(s.subject_type, s.target_grade));
	}

	// initialize score maps per category: CategoryKey → Map<subject_id, total_points>
	const scores = new Map<CategoryKey, Map<string, number>>();
	for (const s of subjects) {
		const key = subjectCategory.get(s.id)!;
		if (!scores.has(key)) {
			scores.set(key, new Map<string, number>());
		}
		scores.get(key)!.set(s.id, 0);
	}

	// single pass: accumulate points from all votes
	for (const vote of preferentialRound) {
		const category = subjectCategory.get(vote.subject_id);
		if (!category) continue;

		const n = subjectCounts.get(category) ?? 0;
		// subject_order=1 (most preferred) → n points, subject_order=n → 1 point
		const points = n - vote.subject_order + 1;

		const categoryScores = scores.get(category)!;
		categoryScores.set(vote.subject_id, (categoryScores.get(vote.subject_id) ?? 0) + points);
	}

	// scores now contains e.g.:
	// "OSE_2" → Map { "subj-abc" => 42, "subj-def" => 37, ... }
	// "OSE_3" → Map { ... }
	// "MVOP_3" → Map { ... }
	// "OSE_4" → Map { ... }

	// count how many divisions (columns) each category has in division_config
	const divisionCounts = new Map<CategoryKey, number>();
	for (const dc of divisionConfig) {
		const key = getCategoryKey(dc.subject_type, dc.target_year);
		divisionCounts.set(key, (divisionCounts.get(key) ?? 0) + 1);
	}

	// keep only categories that need to be split (appear more than once)
	const splitCategories = new Map<CategoryKey, number>();
	for (const [key, count] of divisionCounts) {
		if (count > 1) {
			splitCategories.set(key, count);
		}
	}

	// splitCategories e.g.: Map { "OSE_3" => 2, "OSE_4" => 3 }
	// = categories that need their subjects divided into multiple columns

	// collect column labels per category from divisionConfig
	const columnLabels = new Map<CategoryKey, string[]>();
	for (const dc of divisionConfig) {
		const key = getCategoryKey(dc.subject_type, dc.target_year);
		if (!columnLabels.has(key)) {
			columnLabels.set(key, []);
		}
		columnLabels.get(key)!.push(dc.column_label);
	}

	// result: column_label → list of subject_ids
	const columnAssignments = new Map<string, string[]>();

	for (const [category, categoryScores] of scores) {
		// sort subjects by score descending
		const sorted = [...categoryScores.entries()].sort((a, b) => b[1] - a[1]);

		const labels = columnLabels.get(category) ?? [];
		const numColumns = labels.length;

		if (numColumns <= 1) {
			// single column — no split needed, assign all subjects to that column
			const label = labels[0] ?? category;
			columnAssignments.set(label, sorted.map(([id]) => id));
			continue;
		}

		// initialize columns
		for (const label of labels) {
			columnAssignments.set(label, []);
		}

		// snake draft: A,B,C,C,B,A,A,B,C...
		let colIndex = 0;
		let direction = 1; // 1 = forward, -1 = backward
		for (const [subjectId] of sorted) {
			columnAssignments.get(labels[colIndex])!.push(subjectId);

			const nextIndex = colIndex + direction;
			if (nextIndex >= numColumns || nextIndex < 0) {
				direction *= -1; // reverse direction at boundaries
			} else {
				colIndex = nextIndex;
			}
		}
	}

	// columnAssignments e.g.:
	// for OSE_3 with 2 columns: "A" → ["best", "4th", "5th"], "B" → ["2nd", "3rd", "6th"]
	// for OSE_4 with 3 columns: "A" → [...], "B" → [...], "C" → [...]
	// for OSE_2 with 1 column:  "A" → [all subjects sorted by score]

	return columnAssignments;
}
