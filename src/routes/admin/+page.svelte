<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import type { SortedSubject } from '$lib/subject-sorting';
	import { onMount } from 'svelte';

	interface Props {
		data: {
			user: any;
			waitlistedCount: number;
		};
	}

	let { data }: Props = $props();

	let loading = $state(false);
	let initialLoading = $state(true);
	let error = $state<string | null>(null);
	let multiColumnCategories = $state<string[]>([]);
	let result = $state<{
		ranking: Record<string, SortedSubject[]>;
		columns: Record<string, SortedSubject[]>;
		subjectNames: Record<string, string>;
	} | null>(null);

	let enrollLoading = $state(false);
	let enrollError = $state<string | null>(null);
	let enrollResult = $state<{
		count: number;
		enrollments: Array<{ student_id: string; subject_id: string; target_year: number; subject_type: string }>;
		subjectNames: Record<string, string>;
		studentNames: Record<string, string>;
		subjectColumns: Record<string, string>;
		multiColumnCategories: Record<string, string[]>;
	} | null>(null);

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
		const parts = key.split('_');
		const label = parts.pop()!;
		const category = parts.join('_');
		return `${formatCategory(category)} – sloupec ${label}`;
	}

	function name(id: string): string {
		return result?.subjectNames[id] ?? id;
	}

	async function loadSavedDivision() {
		try {
			const res = await fetch('/admin/division');
			const json = await res.json();
			if (res.ok && !json.empty && json.ranking) {
				result = json;
				multiColumnCategories = Object.keys(json.multiColumnCategories ?? {});
			}
		} catch {
			// silently fail — no saved data
		} finally {
			initialLoading = false;
		}
	}

	async function loadSavedEnrollment() {
		try {
			const res = await fetch('/admin/enrollment');
			const json = await res.json();
			if (res.ok && !json.empty && json.enrollments) {
				enrollResult = json;
			}
		} catch {
			// silently fail — no saved data
		}
	}

	onMount(() => {
		loadSavedDivision();
		loadSavedEnrollment();
	});

	// Reload saved division when navigating back from editor
	afterNavigate(({ from }) => {
		if (from?.url.pathname.includes('division-table')) {
			loadSavedDivision();
		}
	});

	function enrollCategoryLabel(e: { subject_id: string; subject_type: string; target_year: number }): string {
		if (!enrollResult) return '';
		const cat = `${e.subject_type}_${e.target_year}`;
		const labels = enrollResult.multiColumnCategories[cat];
		if (!labels) return formatCategory(cat);
		const colLabel = enrollResult.subjectColumns[e.subject_id];
		return `${formatCategory(cat)} – ${labels.indexOf(colLabel) + 1}`;
	}

	async function runDivision() {
		loading = true;
		error = null;
		result = null;
		multiColumnCategories = [];

		try {
			const res = await fetch('/admin/division', { method: 'POST' });
			const json = await res.json();

			if (!res.ok) {
				error = json.error ?? 'Chyba při spouštění algoritmu';
				return;
			}

			result = json;
			multiColumnCategories = Object.keys(json.multiColumnCategories ?? {});
		} catch (e) {
			error = 'Nepodařilo se spojit se serverem';
		} finally {
			loading = false;
		}
	}

	async function runEnrollment() {
		enrollLoading = true;
		enrollError = null;
		enrollResult = null;

		try {
			const res = await fetch('/admin/enrollment', { method: 'POST' });
			const json = await res.json();

			if (!res.ok) {
				enrollError = json.error ?? 'Chyba při zařazování studentů';
				return;
			}

			enrollResult = json;
		} catch (e) {
			enrollError = 'Nepodařilo se spojit se serverem';
		} finally {
			enrollLoading = false;
		}
	}
</script>

<div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
	<h1 style="margin-bottom: 0.5rem;">Admin Dashboard</h1>
	<p style="color: #666; margin-bottom: 2rem;">Vítejte, {data.user?.email}</p>

	<div style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px;">
			<h2 style="margin-bottom: 0.5rem;">Správa předmětů</h2>
			<p style="margin-bottom: 1rem; color: #666;">Schvalování a zamítání předmětů zadaných učiteli.</p>
			{#if data.waitlistedCount > 0}
				<p style="margin-bottom: 1rem; color: #e67e00; font-weight: 600;">{data.waitlistedCount} {data.waitlistedCount === 1 ? 'předmět čeká' : data.waitlistedCount < 5 ? 'předměty čekají' : 'předmětů čeká'} na vyřízení</p>
			{/if}
			<button onclick={() => goto('/admin/subjects')} style="padding: 0.5rem 1rem; cursor: pointer;">
				Spravovat předměty
			</button>
		</div>

		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px;">
			<h2 style="margin-bottom: 0.5rem;">Nahrát uživatele</h2>
			<p style="margin-bottom: 1rem; color: #666;">Hromadné nahrání uživatelů z CSV nebo Excel souboru.</p>
			<button onclick={() => goto('/admin/upload-users')} style="padding: 0.5rem 1rem; cursor: pointer;">
				Přejít na nahrávání
			</button>
		</div>

		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px;">
			<h2 style="margin-bottom: 0.5rem;">Správa uživatelů</h2>
			<p style="margin-bottom: 1rem; color: #666;">Zobrazit a upravit všechny uživatele v databázi.</p>
			<button onclick={() => goto('/admin/manage-users')} style="padding: 0.5rem 1rem; cursor: pointer;">
				Upravit uživatele
			</button>
		</div>

		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px;">
			<h2 style="margin-bottom: 0.5rem;">Rozdělení předmětů podle popularity</h2>
			<button
				onclick={runDivision}
				disabled={loading}
				style="padding: 0.5rem 1rem; cursor: pointer;"
			>
				{loading ? 'Zpracovávání...' : 'Spustit rozdělení'}
			</button>
		</div>

		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px;">
			<h2 style="margin-bottom: 0.5rem;">Zařazení studentů do předmětů</h2>
			<p style="margin-bottom: 1rem; color: #666;">Přiřadí studentům předměty podle jejich preferencí a rozdělení do sloupců.</p>
			<button
				onclick={runEnrollment}
				disabled={enrollLoading}
				style="padding: 0.5rem 1rem; cursor: pointer;"
			>
				{enrollLoading ? 'Zpracovávání...' : 'Zařadit studenty'}
			</button>
		</div>
	</div>

	{#if error}
		<div style="margin-top: 2rem; padding: 1rem; background: #fee; border: 1px solid #f88; border-radius: 8px; color: #c00;">
			{error}
		</div>
	{/if}

	{#if result}
		<div style="margin-top: 2rem;">
			<!-- TABLE 1: Ranking -->
			<h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Pořadí předmětů podle oblíbenosti</h2>
			<div style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); margin-bottom: 2.5rem;">
				{#each Object.entries(result.ranking) as [category, subjects]}
					<div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
						<div style="background: #f9f9f9; padding: 0.75rem 1rem; font-weight: 600;">
							{formatCategory(category)}
						</div>
						<table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
							<thead>
								<tr style="border-bottom: 1px solid #ddd; text-align: left;">
									<th style="padding: 0.5rem 1rem; width: 3rem;">#</th>
									<th style="padding: 0.5rem 1rem;">Předmět</th>
									<th style="padding: 0.5rem 1rem; text-align: right;">Body</th>
								</tr>
							</thead>
							<tbody>
								{#each subjects as subject, i}
									<tr style="border-bottom: 1px solid #eee;">
										<td style="padding: 0.5rem 1rem; color: #999;">{i + 1}</td>
										<td style="padding: 0.5rem 1rem;">{name(subject.subject_id)}</td>
										<td style="padding: 0.5rem 1rem; text-align: right; font-family: monospace;">{subject.points}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>

			<!-- TABLE 2: Columns -->
			<h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Rozdělení do sloupců</h2>

			{#if multiColumnCategories.length > 0}
				<div style="display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
					{#each multiColumnCategories as cat}
						<button
							onclick={() => goto(`/admin/division-table?category=${cat}`)}
							style="padding: 0.5rem 1rem; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.85rem;"
						>
							Editovat rozřazení – {formatCategory(cat)}
						</button>
					{/each}
				</div>
			{/if}

			<div style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
				{#each Object.entries(result.columns) as [columnKey, subjects]}
					<div style="border: 1px solid #bcd; border-radius: 8px; overflow: hidden;">
						<div style="background: #eef4ff; padding: 0.75rem 1rem; font-weight: 600;">
							{formatColumn(columnKey)}
						</div>
						<table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
							<thead>
								<tr style="border-bottom: 1px solid #ddd; text-align: left;">
									<th style="padding: 0.5rem 1rem; width: 3rem;">#</th>
									<th style="padding: 0.5rem 1rem;">Předmět</th>
									<th style="padding: 0.5rem 1rem; text-align: right;">Body</th>
								</tr>
							</thead>
							<tbody>
								{#each subjects as subject, i}
									<tr style="border-bottom: 1px solid #eee;">
										<td style="padding: 0.5rem 1rem; color: #999;">{i + 1}</td>
										<td style="padding: 0.5rem 1rem;">{name(subject.subject_id)}</td>
										<td style="padding: 0.5rem 1rem; text-align: right; font-family: monospace;">{subject.points}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if enrollError}
		<div style="margin-top: 2rem; padding: 1rem; background: #fee; border: 1px solid #f88; border-radius: 8px; color: #c00;">
			{enrollError}
		</div>
	{/if}

	{#if enrollResult}
		<div style="margin-top: 2rem;">
			<h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Zařazení studentů</h2>
			<p style="color: #666; margin-bottom: 1rem;">Celkem zařazeno: {enrollResult.count} přiřazení</p>

			<div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
				<table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
					<thead>
						<tr style="border-bottom: 1px solid #ddd; text-align: left; background: #f9f9f9;">
							<th style="padding: 0.5rem 1rem;">Student</th>
							<th style="padding: 0.5rem 1rem;">Předmět</th>
							<th style="padding: 0.5rem 1rem;">Kategorie</th>
						</tr>
					</thead>
					<tbody>
						{#each enrollResult.enrollments as e}
							<tr style="border-bottom: 1px solid #eee;">
								<td style="padding: 0.5rem 1rem;">{enrollResult.studentNames[e.student_id] ?? e.student_id}</td>
								<td style="padding: 0.5rem 1rem;">{enrollResult.subjectNames[e.subject_id] ?? e.subject_id}</td>
								<td style="padding: 0.5rem 1rem;">{enrollCategoryLabel(e)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
