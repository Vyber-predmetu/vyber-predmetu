<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	// category from URL, e.g. "OSE_3"
	let category = $derived(new URL($page.url).searchParams.get('category') ?? '');

	let columnLabels = $state<string[]>([]);
	// columns: label → array of { subject_id, name }
	let columns = $state<Record<string, Array<{ subject_id: string; name: string }>>>({});

	const categoryLabels: Record<string, string> = {
		OSE_2: 'OSE – 2. ročník',
		OSE_3: 'OSE – 3. ročník',
		MVOP_3: 'MVOP – 3. ročník',
		OSE_4: 'OSE – 4. ročník'
	};

	let subjectNames = $state<Record<string, string>>({});

	// drag state
	let draggedSubject = $state<{ subject_id: string; name: string; fromColumn: string } | null>(null);

	async function loadData() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/admin/division');
			const json = await res.json();
			if (!res.ok || json.empty) { error = json.error ?? 'Žádné rozřazení k editaci'; return; }

			subjectNames = json.subjectNames ?? {};

			// Filter to only this category's columns
			const prefix = category + '_';
			columnLabels = json.multiColumnCategories[category] ?? [];
			columns = {};
			for (const label of columnLabels) {
				const key = prefix + label;
				const items = json.columns[key] ?? [];
				columns[label] = items.map((s: { subject_id: string }) => ({
					subject_id: s.subject_id,
					name: subjectNames[s.subject_id] ?? s.subject_id
				}));
			}
		} catch {
			error = 'Nepodařilo se načíst data';
		} finally {
			loading = false;
		}
	}

	function handleDragStart(subject: { subject_id: string; name: string }, fromColumn: string) {
		draggedSubject = { ...subject, fromColumn };
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(toColumn: string) {
		if (!draggedSubject || draggedSubject.fromColumn === toColumn) {
			draggedSubject = null;
			return;
		}

		// Remove from source column
		columns[draggedSubject.fromColumn] = columns[draggedSubject.fromColumn].filter(
			s => s.subject_id !== draggedSubject!.subject_id
		);

		// Add to target column
		columns[toColumn] = [...columns[toColumn], { subject_id: draggedSubject.subject_id, name: draggedSubject.name }];

		draggedSubject = null;
	}

	async function saveChanges() {
		saving = true;
		error = null;
		successMsg = null;

		try {
			// Send PATCH for each subject with its current column assignment
			const promises: Promise<Response>[] = [];
			for (const [label, subjects] of Object.entries(columns)) {
				for (const s of subjects) {
					promises.push(
						fetch('/admin/division', {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ subject_id: s.subject_id, new_column_label: label })
						})
					);
				}
			}
			const results = await Promise.all(promises);
			const failed = results.filter(r => !r.ok);
			if (failed.length > 0) {
				error = `${failed.length} změn se nepodařilo uložit`;
			} else {
				successMsg = 'Změny uloženy';
			}
		} catch {
			error = 'Chyba při ukládání';
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		if (category) loadData();
	});
</script>

<div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
	<div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
		<button onclick={() => goto('/admin')} style="padding: 0.4rem 0.8rem; cursor: pointer;">
			← Zpět
		</button>
		<h1 style="margin: 0;">Editovat rozřazení – {categoryLabels[category] ?? category}</h1>
	</div>

	{#if loading}
		<p>Načítání...</p>
	{:else if error}
		<div style="padding: 1rem; background: #fee; border: 1px solid #f88; border-radius: 8px; color: #c00; margin-bottom: 1rem;">
			{error}
		</div>
	{/if}

	{#if !loading && columnLabels.length > 0}
		<p style="color: #666; margin-bottom: 1.5rem;">Přetáhněte předměty mezi sloupci pro úpravu rozřazení.</p>

		<div style="display: grid; grid-template-columns: repeat({columnLabels.length}, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
			{#each columnLabels as label}
				<div
					style="border: 2px dashed #bcd; border-radius: 8px; min-height: 200px; padding: 0;"
					ondragover={handleDragOver}
					ondrop={() => handleDrop(label)}
					role="list"
				>
					<div style="background: #eef4ff; padding: 0.75rem 1rem; font-weight: 600; border-radius: 6px 6px 0 0;">
						Sloupec {label}
						<span style="color: #888; font-weight: 400;">({columns[label]?.length ?? 0} předmětů)</span>
					</div>
					<div style="padding: 0.5rem;">
						{#each columns[label] ?? [] as subject (subject.subject_id)}
							<div
								draggable="true"
								ondragstart={() => handleDragStart(subject, label)}
								style="padding: 0.6rem 0.8rem; margin: 0.4rem 0; background: white; border: 1px solid #ddd; border-radius: 6px; cursor: grab; font-size: 0.875rem; transition: box-shadow 0.15s;"
								role="listitem"
							>
								{subject.name}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<div style="display: flex; gap: 1rem; align-items: center;">
			<button
				onclick={saveChanges}
				disabled={saving}
				style="padding: 0.6rem 1.5rem; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.9rem;"
			>
				{saving ? 'Ukládání...' : 'Uložit změny'}
			</button>
			{#if successMsg}
				<span style="color: #16a34a; font-weight: 500;">{successMsg}</span>
			{/if}
		</div>
	{/if}
</div>
