<script lang="ts">
	import type { SortedSubject } from '$lib/subject-sorting';

	interface Props {
		data: {
			ranking: Record<string, SortedSubject[]>;
			columns: Record<string, SortedSubject[]>;
			subjectNames: Record<string, string>;
		};
	}

	let { data }: Props = $props();

	const categoryLabels: Record<string, string> = {
		OSE_2: 'OSE – 2. ročník',
		OSE_3: 'OSE – 3. ročník',
		MVOP_3: 'MVOP – 3. ročník',
		OSE_4: 'OSE – 4. ročník'
	};

	function formatCategory(key: string): string {
		return categoryLabels[key] ?? key;
	}

	function formatColumn(key: string): string {
		// key format: "OSE_3_A" → "OSE – 3. ročník – sloupec A"
		const parts = key.split('_');
		const label = parts.pop()!;
		const category = parts.join('_');
		return `${formatCategory(category)} – sloupec ${label}`;
	}

	function name(id: string): string {
		return data.subjectNames[id] ?? id;
	}
</script>

<div class="max-w-6xl mx-auto p-8">
	<h1 class="text-2xl font-bold mb-6">Rozdělení předmětů</h1>

	<!-- TABLE 1: Ranking by category -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Pořadí předmětů podle oblíbenosti</h2>

		<div class="grid gap-6 md:grid-cols-2">
			{#each Object.entries(data.ranking) as [category, subjects]}
				<div class="border border-gray-200 rounded-lg overflow-hidden">
					<div class="bg-gray-50 px-4 py-3 font-semibold">
						{formatCategory(category)}
					</div>
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left">
								<th class="px-4 py-2 w-12">#</th>
								<th class="px-4 py-2">Předmět</th>
								<th class="px-4 py-2 text-right">Body</th>
							</tr>
						</thead>
						<tbody>
							{#each subjects as subject, i}
								<tr class="border-b border-gray-100 hover:bg-gray-50">
									<td class="px-4 py-2 text-gray-500">{i + 1}</td>
									<td class="px-4 py-2">{name(subject.subject_id)}</td>
									<td class="px-4 py-2 text-right font-mono">{subject.points}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	</section>

	<!-- TABLE 2: Divided into columns -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Rozdělení do sloupců</h2>

		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each Object.entries(data.columns) as [columnKey, subjects]}
				<div class="border border-gray-200 rounded-lg overflow-hidden">
					<div class="bg-blue-50 px-4 py-3 font-semibold">
						{formatColumn(columnKey)}
					</div>
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left">
								<th class="px-4 py-2 w-12">#</th>
								<th class="px-4 py-2">Předmět</th>
								<th class="px-4 py-2 text-right">Body</th>
							</tr>
						</thead>
						<tbody>
							{#each subjects as subject, i}
								<tr class="border-b border-gray-100 hover:bg-blue-50">
									<td class="px-4 py-2 text-gray-500">{i + 1}</td>
									<td class="px-4 py-2">{name(subject.subject_id)}</td>
									<td class="px-4 py-2 text-right font-mono">{subject.points}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	</section>
</div>
