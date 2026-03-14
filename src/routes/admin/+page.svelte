<script lang="ts">
	import { goto } from '$app/navigation';
	import type { SortedSubject } from '$lib/subject-sorting';

	interface Props {
		data: {
			user: any;
		};
	}

	let { data }: Props = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let result = $state<{
		ranking: Record<string, SortedSubject[]>;
		columns: Record<string, SortedSubject[]>;
		subjectNames: Record<string, string>;
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

	async function runDivision() {
		loading = true;
		error = null;
		result = null;

		try {
			const res = await fetch('/admin/division', { method: 'POST' });
			const json = await res.json();

			if (!res.ok) {
				error = json.error ?? 'Chyba při spouštění algoritmu';
				return;
			}

			result = json;
		} catch (e) {
			error = 'Nepodařilo se spojit se serverem';
		} finally {
			loading = false;
		}
	}
</script>

<div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
	<h1 style="margin-bottom: 0.5rem;">Admin Dashboard</h1>
	<p style="color: #666; margin-bottom: 2rem;">Vítejte, {data.user?.email}</p>

	<div style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
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
			<h2 style="margin-bottom: 0.5rem;">Rozdělení studentů do předmětů</h2>
			<p style="margin-bottom: 1rem; color: #666;">Spustí algoritmus pro rozdělení studentů do předmětů podle preferencí.</p>
			<button
				onclick={runDivision}
				disabled={loading}
				style="padding: 0.5rem 1rem; cursor: pointer;"
			>
				{loading ? 'Zpracovávání...' : 'Spustit rozdělení'}
			</button>
		</div>

		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px; opacity: 0.6;">
			<h2 style="margin-bottom: 0.5rem;">Správa předmětů</h2>
			<p style="color: #666;">Funkce v přípravě</p>
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
</div>
