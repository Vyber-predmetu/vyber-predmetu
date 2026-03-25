
<script lang="ts">
	let { data, form } = $props();
	let name = $state('');
	let description = $state('');
	let target_grade = $state('');
	let type_of_subject = $state('');
	let expandedSubjects = $state<Record<number, boolean>>({});

	let submissionWindow = data.submissionWindow;
	let now = $derived(() => new Date());
	let start = $derived(() => submissionWindow?.start ? new Date(submissionWindow.start) : null);
	let end = $derived(() => submissionWindow?.end ? new Date(submissionWindow.end) : null);
	let canSubmit = $derived(() => {
		const s = start();
		const e = end();
		const n = now();
		return s && e && n >= s && n <= e;
	});


	function getFeedback(start: Date | null, end: Date | null, now: Date): string {
		if (!start || !end) return 'Není nastaveno období pro posílání předmětů.';
		if (now < start) return `Posílání předmětů se otevře ${start.toLocaleString('cs-CZ')}`;
		if (now > end) return 'Posílání předmětů je uzavřeno. Pokud jste nestihli, kontaktujte administrátora.';
		return `Posílání předmětů bude otevřené do ${end.toLocaleString('cs-CZ')}`;
	}
</script>

<div>
	<h1>Učitelský Dashboard</h1>
	<p>Vítejte, {data.user?.email}</p>

	<div >
		<strong>{getFeedback(start(), end(), now())}</strong>
	</div>

	{#if canSubmit()}
		<form method="POST" action="?/addSubject" class="mb-6 space-y-4">
			<div>
				<label for="name">Název předmětu</label>
				<input id="name" name="name" bind:value={name} required class="input" />
			</div>
			<div>
				<label for="description">Popis předmětu</label>
				<textarea id="description" name="description" bind:value={description} required class="input"></textarea>
			</div>
			<div>
				<label for="target_grade">Ročník</label>
				<select id="target_grade" name="target_grade" bind:value={target_grade} required class="input">
					<option value="" disabled selected>Vyberte ročník</option>
					<option value="2">2</option>
					<option value="3">3</option>
					<option value="4">4</option>
				</select>
			</div>
			<div>
				<label for="type_of_subject">Typ předmětu</label>
				<select id="type_of_subject" name="type_of_subject" bind:value={type_of_subject} required class="input">
					<option value="" disabled selected>Vyberte typ</option>
					<option value="OSE">OSE</option>
					<option value="MVOP">MVOP</option>
				</select>
			</div>
			{#if form?.error}
				<div class="text-red-600">{form.error}</div>
			{/if}
			{#if form?.success}
				<div class="text-green-600">Předmět byl úspěšně přidán.</div>
			{/if}
			<button type="submit" class="btn" name="addSubject">Přidat předmět</button>
		</form>
	{/if}

	<h2>Vaše předměty</h2>
	{#if data.subjects?.length}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.subjects as subject}
				{@const students = data.enrollmentsBySubject?.[subject.id] ?? []}
				<div class="p-4 border rounded bg-white shadow">
					<div class="font-bold">{subject.name}</div>
					<div>{subject.description}</div>
					<div>Ročník: {subject.target_grade}</div>
					<div>Typ: {subject.subject_type}</div>
					<div>Stav: {subject.state === 'accepted' ? 'Schváleno' : subject.state === 'rejected' ? 'Zamítnuto' : 'Čeká na schválení'}</div>
					<div style="margin-top: 0.5rem;">
						Počet studentů: <strong>{students.length}</strong>
						{#if students.length > 0}
							<button
								type="button"
								style="margin-left: 0.5rem; cursor: pointer; background: none; border: none; color: #2563eb; text-decoration: underline;"
								onclick={() => expandedSubjects[subject.id] = !expandedSubjects[subject.id]}
							>
								{expandedSubjects[subject.id] ? 'Skrýt studenty' : 'Zobrazit studenty'}
							</button>
						{/if}
					</div>
					{#if expandedSubjects[subject.id]}
						<ul style="margin-top: 0.5rem; padding-left: 1.2rem;">
							{#each students as student}
								<li>{student.first_name} {student.last_name}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p>Nemáte zatím žádné předměty.</p>
	{/if}
</div>
