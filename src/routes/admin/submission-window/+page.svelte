<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		data: {
			user: any;
			submissionWindow: {
				id: number;
				start: string;
				end: string;
			} | null;
		};
	}

	let { data }: Props = $props();

	function toLocalDatetime(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		const offset = d.getTimezoneOffset();
		const local = new Date(d.getTime() - offset * 60000);
		return local.toISOString().slice(0, 16);
	}

	let startValue = $state(toLocalDatetime(data.submissionWindow?.start));
	let endValue = $state(toLocalDatetime(data.submissionWindow?.end));
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	function formatDisplay(iso: string | null | undefined): string {
		if (!iso) return '–';
		return new Date(iso).toLocaleString('cs-CZ');
	}

	let isActive = $derived(() => {
		if (!data.submissionWindow) return false;
		const now = new Date();
		const start = new Date(data.submissionWindow.start);
		const end = new Date(data.submissionWindow.end);
		return now >= start && now <= end;
	});

	async function save() {
		if (!startValue || !endValue) {
			errorMsg = 'Vyplňte oba časy.';
			return;
		}
		const start = new Date(startValue);
		const end = new Date(endValue);
		if (end <= start) {
			errorMsg = 'Konec musí být po začátku.';
			return;
		}

		saving = true;
		errorMsg = null;
		successMsg = null;

		try {
			const res = await fetch('/admin/submission-window', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
				start: start.toISOString(),
				end: end.toISOString()
				})
			});
			const json = await res.json();
			if (!res.ok) {
				errorMsg = json.error ?? 'Chyba při ukládání';
				return;
			}
			data.submissionWindow = json.submissionWindow;
			successMsg = 'Časové okno bylo uloženo.';
		} catch {
			errorMsg = 'Nepodařilo se spojit se serverem.';
		} finally {
			saving = false;
		}
	}

	async function setStartToNow() {
		startValue = toLocalDatetime(new Date().toISOString());
	}

	async function setEndToNow() {
		endValue = toLocalDatetime(new Date().toISOString());
	}
</script>

<div style="max-width: 700px; margin: 0 auto; padding: 2rem;">
	<div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
		<button onclick={() => goto('/admin')} style="padding: 0.4rem 0.8rem; cursor: pointer;">← Zpět</button>
		<h1 style="margin: 0;">Časové okno pro odesílání předmětů</h1>
	</div>

	{#if data.submissionWindow}
		<div style="padding: 1rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1.5rem; background: {isActive() ? '#f0fdf4' : '#f9fafb'};">
			<h3 style="margin: 0 0 0.5rem;">Aktuální nastavení</h3>
			<p style="margin: 0.25rem 0;">Začátek: <strong>{formatDisplay(data.submissionWindow.start)}</strong></p>
			<p style="margin: 0.25rem 0;">Konec: <strong>{formatDisplay(data.submissionWindow.end)}</strong></p>
			<p style="margin: 0.5rem 0 0; font-weight: 600; color: {isActive() ? '#16a34a' : '#dc2626'};">
				{isActive() ? '✓ Odesílání je právě otevřené' : '✗ Odesílání je zavřené'}
			</p>
		</div>
	{:else}
		<div style="padding: 1rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1.5rem; background: #fef9c3; color: #854d0e;">
			Časové okno zatím nebylo nastaveno.
		</div>
	{/if}

	<div style="display: flex; flex-direction: column; gap: 1rem;">
		<div>
			<label for="start" style="display: block; font-weight: 600; margin-bottom: 0.25rem;">Začátek</label>
			<div style="display: flex; gap: 0.5rem; align-items: center;">
				<input
					id="start"
					type="datetime-local"
					bind:value={startValue}
					style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem;"
				/>
				<button onclick={setStartToNow} style="padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.85rem;">
					Teď
				</button>
			</div>
		</div>

		<div>
			<label for="end" style="display: block; font-weight: 600; margin-bottom: 0.25rem;">Konec</label>
			<div style="display: flex; gap: 0.5rem; align-items: center;">
				<input
					id="end"
					type="datetime-local"
					bind:value={endValue}
					style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem;"
				/>
				<button onclick={setEndToNow} style="padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.85rem;">
					Teď
				</button>
			</div>
		</div>
	</div>

	{#if errorMsg}
		<div style="margin-top: 1rem; padding: 0.75rem 1rem; background: #fee; border: 1px solid #f88; border-radius: 8px; color: #c00;">
			{errorMsg}
		</div>
	{/if}

	{#if successMsg}
		<div style="margin-top: 1rem; padding: 0.75rem 1rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; color: #16a34a;">
			{successMsg}
		</div>
	{/if}

	<button
		onclick={save}
		disabled={saving}
		style="margin-top: 1.5rem; padding: 0.6rem 1.5rem; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 1rem;"
	>
		{saving ? 'Ukládání...' : 'Uložit'}
	</button>
</div>
