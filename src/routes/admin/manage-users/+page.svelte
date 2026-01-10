<script lang="ts">
	let users = $state<any[]>([]);
	let editingCell = $state<{ row: number; col: string } | null>(null);
	let saving = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let result = $state<{ success: number; errors: string[] } | null>(null);
	let selectedUsers = $state<Set<string>>(new Set());
	let deleting = $state(false);

	async function loadUsers() {
		loading = true;
		error = null;
		
		try {
			const response = await fetch('/admin/upload-users?load=true');
			const data = await response.json();
			
			console.log('Response status:', response.status);
			console.log('Response data:', data);
			
			if (!response.ok) {
				error = data.error || 'Chyba při načítání';
				return;
			}
			
			if (data.users) {
				users = data.users;
				console.log('Loaded users:', users.length);
			}
		} catch (e) {
			error = 'Chyba při načítání uživatelů';
			console.error('Chyba při načítání uživatelů:', e);
		} finally {
			loading = false;
		}
	}

	function startEdit(row: number, col: string) {
		editingCell = { row, col };
	}

	function updateCell(row: number, col: string, value: string) {
		users[row][col] = value;
		editingCell = null;
	}

	async function saveChanges() {
		saving = true;
		error = null;
		result = null;

		try {
			const response = await fetch('/admin/upload-users', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ users })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Chyba při ukládání';
				return;
			}

			result = { success: data.updated, errors: data.errors || [] };
			
			// Znovu načíst data po uložení
			await loadUsers();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Chyba při ukládání';
		} finally {
			saving = false;
		}
	}

	function toggleUser(userId: string) {
		if (selectedUsers.has(userId)) {
			selectedUsers.delete(userId);
		} else {
			selectedUsers.add(userId);
		}
		selectedUsers = new Set(selectedUsers);
	}

	function toggleAll() {
		if (selectedUsers.size === users.length) {
			selectedUsers = new Set();
		} else {
			selectedUsers = new Set(users.map(u => u.id));
		}
	}

	async function deleteSelected() {
		if (selectedUsers.size === 0) return;
		
		if (!confirm(`Opravdu chcete smazat ${selectedUsers.size} uživatelů?`)) {
			return;
		}

		deleting = true;
		error = null;
		result = null;

		try {
			const response = await fetch('/admin/upload-users', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userIds: Array.from(selectedUsers) })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Chyba při mazání';
				return;
			}

			result = { success: data.deleted, errors: data.errors || [] };
			selectedUsers = new Set();
			
			// Znovu načíst data
			await loadUsers();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Chyba při mazání';
		} finally {
			deleting = false;
		}
	}

	// Načíst uživatele při načtení stránky
	$effect(() => {
		loadUsers();
	});
</script>

<div style="max-width: 1400px; margin: 0 auto; padding: 2rem;">
	<h1 style="margin-bottom: 2rem;">Správa uživatelů</h1>

	{#if loading}
		<div style="text-align: center; padding: 2rem;">
			<p>Načítám uživatele...</p>
		</div>
	{:else if users.length === 0}
		<div style="border: 1px solid #ddd; padding: 2rem; border-radius: 8px; text-align: center;">
			<p style="color: #666;">Žádní uživatelé v databázi.</p>
			<p style="margin-top: 1rem;">
				<a href="/admin/upload-users" style="color: #0066cc;">Nahrát uživatele z CSV/Excel</a>
			</p>
		</div>
	{:else}
		<div style="border: 1px solid #ddd; padding: 2rem; border-radius: 8px;">
			<div style="margin-bottom: 1rem;">
				<p style="color: #666;">Celkem {users.length} uživatelů</p>
			</div>

			{#if error}
				<div style="margin-bottom: 1rem; padding: 1rem; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
					<p style="font-weight: 500;">Chyba:</p>
					<p>{error}</p>
				</div>
			{/if}

			{#if result}
				<div style="margin-bottom: 1rem; padding: 1rem; background: #efe; border: 1px solid #cfc; border-radius: 4px;">
					<p style="font-weight: 500;">Úspěšně uloženo: {result.success} uživatelů</p>
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
			
			<div style="overflow-x: auto;">
				<table style="width: 100%; border-collapse: collapse;">
					<thead>
						<tr style="background: #f5f5f5;">
							<th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd; width: 40px;">
								<input
									type="checkbox"
									checked={selectedUsers.size === users.length}
									onchange={toggleAll}
									style="cursor: pointer;"
								/>
							</th>
							<th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Email</th>
							<th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Jméno</th>
							<th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Příjmení</th>
							<th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Role</th>
							<th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Třída</th>
							<th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Maturita</th>
						</tr>
					</thead>
					<tbody>
						{#each users as user, i}
							<tr style="background: {i % 2 === 0 ? 'white' : '#f9f9f9'};">
								<td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">
									<input
										type="checkbox"
										checked={selectedUsers.has(user.id)}
										onchange={() => toggleUser(user.id)}
										style="cursor: pointer;"
									/>
								</td>
								{#each ['email', 'first_name', 'last_name', 'role_name', 'class_letter', 'graduation_year'] as col}
									<td 
										style="padding: 0.5rem; border: 1px solid #ddd; cursor: pointer; position: relative;"
										onclick={() => startEdit(i, col)}
									>
										{#if editingCell?.row === i && editingCell?.col === col}
											<input
												type="text"
												value={user[col] || ''}
												onblur={(e) => updateCell(i, col, e.currentTarget.value)}
												onkeydown={(e) => {
													if (e.key === 'Enter') {
														updateCell(i, col, e.currentTarget.value);
													} else if (e.key === 'Escape') {
														editingCell = null;
													}
												}}
												style="width: 100%; border: 2px solid #0066cc; padding: 0.25rem; box-sizing: border-box;"
											/>
										{:else}
											<span style="display: block; min-height: 1.5rem;">
												{user[col] || '—'}
											</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div style="margin-top: 1rem; display: flex; gap: 1rem;">
				<button 
					onclick={saveChanges} 
					disabled={saving}
					style="flex: 1; padding: 0.75rem; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 1rem;"
				>
					{saving ? 'Ukládám...' : 'Uložit změny'}
				</button>

				{#if selectedUsers.size > 0}
					<button 
						onclick={deleteSelected} 
						disabled={deleting}
						style="padding: 0.75rem 1.5rem; cursor: pointer; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 1rem;"
					>
						{deleting ? 'Mažu...' : `Smazat ${selectedUsers.size} uživatelů`}
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
