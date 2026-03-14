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

export type SortedSubject = {
	subject_id: string;
	points: number;
};

export type SortResult = {
	// Table 1: subjects sorted by popularity per category
	ranking: Record<string, SortedSubject[]>;
	// Table 2: subjects sorted + divided into columns (with category prefix)
	columns: Record<string, SortedSubject[]>;
};

export function studentSort(
	preferentialRound: PreferentialRound[],
	divisionConfig: DivisionConfig[],
	subjects: Subject[]
): SortResult {
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

	// collect column labels per category from divisionConfig
	const columnLabels = new Map<CategoryKey, string[]>();
	for (const dc of divisionConfig) {
		const key = getCategoryKey(dc.subject_type, dc.target_year);
		if (!columnLabels.has(key)) {
			columnLabels.set(key, []);
		}
		columnLabels.get(key)!.push(dc.column_label);
	}

	// TABLE 1: ranking — subjects sorted by popularity per category
	const ranking: Record<string, SortedSubject[]> = {};
	for (const [category, categoryScores] of scores) {
		ranking[category] = [...categoryScores.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([subject_id, points]) => ({ subject_id, points }));
	}

	// TABLE 2: columns — sorted + divided into columns where needed
	const columns: Record<string, SortedSubject[]> = {};

	for (const [category, categoryScores] of scores) {
		const sorted = [...categoryScores.entries()].sort((a, b) => b[1] - a[1]);

		const labels = columnLabels.get(category) ?? [];
		const numColumns = labels.length;

		if (numColumns <= 1) {
			// single column — use "CATEGORY_LABEL" as key
			const label = labels[0] ?? category;
			const key = `${category}_${label}`;
			columns[key] = sorted.map(([subject_id, points]) => ({ subject_id, points }));
			continue;
		}

		// initialize columns
		for (const label of labels) {
			columns[`${category}_${label}`] = [];
		}

		// snake draft: A,B,C,C,B,A,A,B,C...
		let colIndex = 0;
		let direction = 1;
		for (const [subjectId, points] of sorted) {
			columns[`${category}_${labels[colIndex]}`].push({ subject_id: subjectId, points });

			const nextIndex = colIndex + direction;
			if (nextIndex >= numColumns || nextIndex < 0) {
				direction *= -1;
			} else {
				colIndex = nextIndex;
			}
		}
	}

	return { ranking, columns };
}
