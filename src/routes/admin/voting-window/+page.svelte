<script lang="ts">
	import { goto } from '$app/navigation';

	interface VotingWindow {
		id: number;
		target_year: number;
		start: string;
		end: string;
	}

	interface Props {
		data: {
			user: any;
			votingWindows: VotingWindow[];
		};
	}

	let { data }: Props = $props();

	const targetYears = [2, 3, 4] as const;

	function toLocalDatetime(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		const offset = d.getTimezoneOffset();
		const local = new Date(d.getTime() - offset * 60000);
		return local.toISOString().slice(0, 16);
	}

	function formatDisplay(iso: string | null | undefined): string {
		if (!iso) return '–';
		return new Date(iso).toLocaleString('cs-CZ');
	}

	function isActive(window: VotingWindow): boolean {
		const now = new Date();
		return now >= new Date(window.start) && now <= new Date(window.end);
	}

	function getWindow(year: number): VotingWindow | undefined {
		return data.votingWindows.find((w) => Number(w.target_year) === year);
	}

	let startValues = $state<Record<number, string>>(
		Object.fromEntries(targetYears.map((y) => [y, toLocalDatetime(getWindow(y)?.start)]))
	);
	let endValues = $state<Record<number, string>>(
		Object.fromEntries(targetYears.map((y) => [y, toLocalDatetime(getWindow(y)?.end)]))
	);

	let saving = $state<number | null>(null);
	let errorMsg = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	async function save(year: number) {
		const startVal = startValues[year];
		const endVal = endValues[year];

		if (!startVal || !endVal) {
			errorMsg = `Vyplňte oba časy pro ${year}. ročník.`;
			successMsg = null;
			return;
		}
		const start = new Date(startVal);
		const end = new Date(endVal);
		if (end <= start) {
			errorMsg = `Konec musí být po začátku (${year}. ročník).`;
			successMsg = null;
			return;
		}

		saving = year;
		errorMsg = null;
		successMsg = null;

		try {
			const res = await fetch('/admin/voting-window', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					target_year: year,
					start: start.toISOString(),
					end: end.toISOString()
				})
			});
			const json = await res.json();
			if (!res.ok) {
				errorMsg = json.error ?? 'Chyba při ukládání';
				return;
			}
			const updated = json.votingWindow as VotingWindow;
			const idx = data.votingWindows.findIndex((w) => Number(w.target_year) === year);
			if (idx >= 0) {
				data.votingWindows[idx] = updated;
			} else {
				data.votingWindows = [...data.votingWindows, updated];
			}
			successMsg = `Hlasovací okno pro ${year}. ročník bylo uloženo.`;
		} catch {
			errorMsg = 'Nepodařilo se spojit se serverem.';
		} finally {
			saving = null;
		}
	}
</script>

<div style="max-width: 900px; margin: 0 auto; padding: 2rem;">
	<div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
		<button onclick={() => goto('/admin')} style="padding: 0.4rem 0.8rem; cursor: pointer;">← Zpět</button>
		<h1 style="margin: 0;">Hlasovací okna</h1>
	</div>

	{#if errorMsg}
		<div style="padding: 0.75rem 1rem; background: #fee; border: 1px solid #f88; border-radius: 8px; margin-bottom: 1rem; color: #c00;">
			{errorMsg}
		</div>
	{/if}

	{#if successMsg}
		<div style="padding: 0.75rem 1rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; margin-bottom: 1rem; color: #16a34a;">
			{successMsg}
		</div>
	{/if}

	<div style="display: flex; flex-direction: column; gap: 1.5rem;">
		{#each targetYears as year}
			{@const existing = getWindow(year)}
			<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px; background: {existing && isActive(existing) ? '#f0fdf4' : '#fff'};">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
					<h2 style="margin: 0;">{year}. ročník</h2>
					{#if existing}
						<span style="padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; color: white; background: {isActive(existing) ? '#16a34a' : '#dc2626'};">
							{isActive(existing) ? 'Otevřené' : 'Zavřené'}
						</span>
					{:else}
						<span style="padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; color: #854d0e; background: #fef9c3;">
							Nenastaveno
						</span>
					{/if}
				</div>

				{#if existing}
					<p style="margin: 0 0 0.75rem; color: #666; font-size: 0.9rem;">
						Aktuální: {formatDisplay(existing.start)} – {formatDisplay(existing.end)}
					</p>
				{/if}

				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
					<div>
						<label for="start-{year}" style="display: block; font-weight: 600; margin-bottom: 0.25rem; font-size: 0.9rem;">Začátek</label>
						<div style="display: flex; gap: 0.5rem; align-items: center;">
							<input
								id="start-{year}"
								type="datetime-local"
								bind:value={startValues[year]}
								style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 6px; font-size: 0.9rem; flex: 1;"
							/>
							<button onclick={() => startValues[year] = toLocalDatetime(new Date().toISOString())} style="padding: 0.4rem 0.6rem; cursor: pointer; font-size: 0.8rem;">
								Teď
							</button>
						</div>
					</div>
					<div>
						<label for="end-{year}" style="display: block; font-weight: 600; margin-bottom: 0.25rem; font-size: 0.9rem;">Konec</label>
						<div style="display: flex; gap: 0.5rem; align-items: center;">
							<input
								id="end-{year}"
								type="datetime-local"
								bind:value={endValues[year]}
								style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 6px; font-size: 0.9rem; flex: 1;"
							/>
							<button onclick={() => endValues[year] = toLocalDatetime(new Date().toISOString())} style="padding: 0.4rem 0.6rem; cursor: pointer; font-size: 0.8rem;">
								Teď
							</button>
						</div>
					</div>
				</div>

				<button
					onclick={() => save(year)}
					disabled={saving === year}
					style="padding: 0.5rem 1.25rem; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.9rem;"
				>
					{saving === year ? 'Ukládání...' : 'Uložit'}
				</button>
			</div>
		{/each}
	</div>
</div>
