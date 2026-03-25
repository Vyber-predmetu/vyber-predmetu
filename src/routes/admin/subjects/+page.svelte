<script lang="ts">
	import { goto } from '$app/navigation';

	interface Subject {
		id: number;
		name: string;
		description: string;
		subject_type: string;
		target_grade: number;
		state: string;
		created_at: string;
		teacher_id: string;
	}

	interface Props {
		data: {
			user: any;
			subjects: Subject[];
			teacherEmails: Record<string, string>;
		};
	}

	let { data }: Props = $props();
	let subjects = $state(data.subjects);
	let filter = $state<'all' | 'waitlisted' | 'accepted' | 'rejected'>('all');
	let updating = $state<number | null>(null);
	let errorMsg = $state<string | null>(null);

	let filtered = $derived(
		filter === 'all' ? subjects : subjects.filter((s) => s.state === filter)
	);

	let waitlistedCount = $derived(subjects.filter((s) => s.state === 'waitlisted').length);

	function stateLabel(state: string): string {
		if (state === 'accepted') return 'Schváleno';
		if (state === 'rejected') return 'Zamítnuto';
		return 'Čeká na vyřízení';
	}

	function stateColor(state: string): string {
		if (state === 'accepted') return '#16a34a';
		if (state === 'rejected') return '#dc2626';
		return '#e67e00';
	}

	async function updateState(subjectId: number, newState: string) {
		updating = subjectId;
		errorMsg = null;
		try {
			const res = await fetch('/admin/subjects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subject_id: subjectId, state: newState })
			});
			const json = await res.json();
			if (!res.ok) {
				errorMsg = json.error ?? 'Chyba při aktualizaci';
				return;
			}
			subjects = subjects.map((s) =>
				s.id === subjectId ? { ...s, state: newState } : s
			);
		} catch {
			errorMsg = 'Nepodařilo se spojit se serverem';
		} finally {
			updating = null;
		}
	}
</script>

<div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
	<div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
		<button onclick={() => goto('/admin')} style="padding: 0.4rem 0.8rem; cursor: pointer;">← Zpět</button>
		<h1 style="margin: 0;">Správa předmětů</h1>
	</div>

	{#if waitlistedCount > 0}
		<div style="padding: 0.75rem 1rem; background: #fff7ed; border-radius: 8px; margin-bottom: 1.5rem; color: #92400e;">
		    {waitlistedCount} {waitlistedCount === 1 ? 'předmět čeká' : waitlistedCount < 5 ? 'předměty čekají' : 'předmětů čeká'} na vyřízení
		</div>
	{/if}

	<div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
		<button onclick={() => filter = 'all'} style="padding: 0.4rem 0.8rem; cursor: pointer; {filter === 'all' ? 'font-weight: bold; text-decoration: underline;' : ''}">
			Všechny ({subjects.length})
		</button>
		<button onclick={() => filter = 'waitlisted'} style="padding: 0.4rem 0.8rem; cursor: pointer; {filter === 'waitlisted' ? 'font-weight: bold; text-decoration: underline;' : ''}">
			Čekající ({subjects.filter(s => s.state === 'waitlisted').length})
		</button>
		<button onclick={() => filter = 'accepted'} style="padding: 0.4rem 0.8rem; cursor: pointer; {filter === 'accepted' ? 'font-weight: bold; text-decoration: underline;' : ''}">
			Schválené ({subjects.filter(s => s.state === 'accepted').length})
		</button>
		<button onclick={() => filter = 'rejected'} style="padding: 0.4rem 0.8rem; cursor: pointer; {filter === 'rejected' ? 'font-weight: bold; text-decoration: underline;' : ''}">
			Zamítnuté ({subjects.filter(s => s.state === 'rejected').length})
		</button>
	</div>

	{#if errorMsg}
		<div style="padding: 0.75rem 1rem; background: #fee; border: 1px solid #f88; border-radius: 8px; margin-bottom: 1rem; color: #c00;">
			{errorMsg}
		</div>
	{/if}

	{#if filtered.length === 0}
		<p style="color: #666;">Žádné předměty v této kategorii.</p>
	{:else}
		<div style="display: flex; flex-direction: column; gap: 1rem;">
			{#each filtered as subject (subject.id)}
				<div style="border: 1px solid #ddd; padding: 1.25rem; border-radius: 8px; display: flex; flex-direction: column; gap: 0.5rem;">
					<div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
						<div>
							<h3 style="margin: 0;">{subject.name}</h3>
							<p style="margin: 0.25rem 0; color: #666; font-size: 0.875rem;">
								{subject.subject_type} · {subject.target_grade}. ročník · {data.teacherEmails[subject.teacher_id] ?? 'Neznámý učitel'}
							</p>
						</div>
						<span style="padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; color: white; background: {stateColor(subject.state)};">
							{stateLabel(subject.state)}
						</span>
					</div>

					<p style="margin: 0; color: #444; font-size: 0.9rem;">{subject.description}</p>

					<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
						{#if subject.state !== 'accepted'}
							<button
								onclick={() => updateState(subject.id, 'accepted')}
								disabled={updating === subject.id}
								style="padding: 0.4rem 0.8rem; cursor: pointer; background: #009951; color: white; border: none; border-radius: 6px;"
							>
								{updating === subject.id ? '...' : 'Schválit'}
							</button>
						{/if}
						{#if subject.state !== 'rejected'}
							<button
								onclick={() => updateState(subject.id, 'rejected')}
								disabled={updating === subject.id}
								style="padding: 0.4rem 0.8rem; cursor: pointer; background: #FF5356; color: white; border: none; border-radius: 6px;"
							>
								{updating === subject.id ? '...' : 'Zamítnout'}
							</button>
						{/if}
						{#if subject.state !== 'waitlisted'}
							<button
								onclick={() => updateState(subject.id, 'waitlisted')}
								disabled={updating === subject.id}
								style="padding: 0.4rem 0.8rem; cursor: pointer; background: #e67e00; color: white; border: none; border-radius: 6px;"
							>
								{updating === subject.id ? '...' : 'Vrátit na čekání'}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
