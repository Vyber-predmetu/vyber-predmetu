<script lang="ts">
	import { goto } from '$app/navigation';

	let file: File | null = $state(null);
	let uploading = $state(false);
	let result = $state<{ success: number; errors: string[] } | null>(null);
	let error = $state<string | null>(null);

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			file = target.files[0];
			result = null;
			error = null;
		}
	}

	async function handleUpload() {
		if (!file) return;

		uploading = true;
		error = null;
		result = null;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/admin/upload-users', {
				method: 'POST',
				body: formData
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Něco se pokazilo';
				return;
			}

			result = data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Chyba při nahrávání';
		} finally {
			uploading = false;
		}
	}

</script>

<div style="max-width: 800px; margin: 0 auto; padding: 2rem;">
	<h1 style="margin-bottom: 2rem;">Nahrát uživatele z CSV/Excel</h1>

	<div style="border: 1px solid #ddd; padding: 2rem; border-radius: 8px;">
		<div style="margin-bottom: 1.5rem;">
			<label for="file-upload" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Vyberte CSV nebo Excel soubor</label>
			<input
				id="file-upload"
				type="file"
				accept=".csv,.xlsx,.xls"
				onchange={handleFileChange}
				disabled={uploading}
				style="display: block; width: 100%; padding: 0.5rem;"
			/>
		</div>

		<div style="background: #f5f5f5; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
			<p style="font-weight: 500; margin-bottom: 0.5rem;">Formát CSV/Excel:</p>
			<ul style="margin-left: 1.5rem;">
				<li><strong>email</strong> - email uživatele (povinné)</li>
				<li><strong>first_name</strong> - křestní jméno (povinné)</li>
				<li><strong>last_name</strong> - příjmení (povinné)</li>
				<li><strong>role</strong> - role oddělené čárkou: "student", "teacher", "admin" nebo např. "admin, teacher" (povinné)</li>
				<li><strong>class_letter</strong> - třída (jen pro studenty): A, B, C, K, Ga, Gb</li>
				<li><strong>graduation_year</strong> - rok maturity (jen pro studenty)</li>
			</ul>
			<p style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">
				💡 Pro více rolí použij čárku, např.: "admin, teacher" nebo "student, teacher"
			</p>
		</div>

		<button 
			onclick={handleUpload} 
			disabled={!file || uploading}
			style="width: 100%; padding: 0.75rem; cursor: pointer; background: #0066cc; color: white; border: none; border-radius: 4px; font-size: 1rem;"
		>
			{uploading ? 'Nahrávám...' : 'Nahrát uživatele'}
		</button>

		{#if error}
			<div style="margin-top: 1rem; padding: 1rem; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
				<p style="font-weight: 500;">Chyba:</p>
				<p>{error}</p>
			</div>
		{/if}

		{#if result}
			<div style="margin-top: 1rem; padding: 1rem; background: #efe; border: 1px solid #cfc; border-radius: 4px;">
				<p style="font-weight: 500;">Úspěšně nahráno: {result.success} uživatelů</p>
				{#if result.errors.length > 0}
					<p style="font-weight: 500; margin-top: 0.5rem;">Chyby:</p>
					<ul style="margin-left: 1.5rem;">
						{#each result.errors as err}
							<li>{err}</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<div style="margin-top: 1rem; text-align: center;">
			<a href="/admin/manage-users" style="color: #0066cc; text-decoration: none;">
				→ Přejít na správu uživatelů
			</a>
		</div>
	</div>
</div>
