<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';

  let subjects: Array<{ id: string; name: string }> = [];
  let orderedSubjects: Array<{ id: string; name: string }> = [];
  let loading = true;
  let error = '';
  let submitting = false;
  let alreadyVoted = false;
``
  export let data: any;
  let type = '';
  let grade = 0;
  let student_id = '';

  $: type = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('type') || '' : '';
  $: grade = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('grade')) : 0;
  $: student_id = (data?.user && (typeof data.user.db_id === 'string' ? data.user.db_id : data.user.id)) || '';

  onMount(async () => {
    if (!type || !grade) {
      error = 'Missing type or grade.';
      loading = false;
      return;
    }
    try {
      if (student_id) {
        const resVote = await fetch(`/voting/already-voted?student_id=${student_id}&type=${type}&grade=${grade}`);
        const voteData = await resVote.json();
        if (voteData.alreadyVoted) {
          alreadyVoted = true;
          error = 'Již jste hlasoval(a) v této kategorii.';
          setTimeout(() => {
            goto(`/dashboard?error=alreadyVoted`);
          }, 1500);
          return;
        }
      }
      const url = `/api/dashboard?type=${type}&grade=${grade}`;
      console.log('Fetching:', url);
      const res = await fetch(url);
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Response text:', text);
      let apiData;
      try {
        apiData = JSON.parse(text);
      } catch (e) {
        let msg = 'Chyba při parsování JSON.';
        if (e instanceof Error && e.message) {
          msg += ' ' + e.message;
        }
        error = msg + '\n' + text;
        return;
      }
      if (apiData.error) {
        error = apiData.error;
      } else {
        subjects = apiData.subjects;
        orderedSubjects = [...subjects];
      }
    } catch (e) {
      let msg = 'Failed to fetch subjects.';
      if (e instanceof Error && e.message) {
        msg += ' ' + e.message;
      }
      error = msg;
      console.error('Failed to fetch subjects:', e);
    }
    loading = false;
  });

  let dragIndex: number | null = null;
  function handleDragStart(i: number) {
    dragIndex = i;
  }
  function handleDragOver(e: DragEvent, i: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    const newOrder = [...orderedSubjects];
    const [moved] = newOrder.splice(dragIndex, 1);
    newOrder.splice(i, 0, moved);
    orderedSubjects = newOrder;
    dragIndex = i;
  }
  function handleDrop() {
    dragIndex = null;
  }

  async function submitPreferences() {
    if (alreadyVoted) {
      error = 'Již jste hlasoval(a) v této kategorii.';
      return;
    }
    submitting = true;
    error = '';
    if (!student_id) {
      error = 'Chybí ID uživatele.';
      submitting = false;
      return;
    }
    if (!orderedSubjects || orderedSubjects.length === 0) {
      error = 'Nejsou k dispozici žádné předměty k seřazení.';
      submitting = false;
      return;
    }
    const preferences = orderedSubjects.map((subj, idx) => ({
      subject_id: subj.id,
      subject_order: idx + 1
    }));
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, preferences })
      });
      const data = await res.json();
      if (res.status === 400) {
        error = '';
        await tick();
        error = data.error || 'Hlasování není možné.';
        submitting = false;
        await tick();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(async () => {
          await tick();
          goto('/dashboard?error=alreadyVoted');
        }, 1500);
        return;
      }
      if (data.success) {
        goto('/dashboard');
      } else {
        error = data.error || 'Failed to save preferences.';
      }
    } catch (e) {
      error = 'Failed to save preferences.';
    }
    submitting = false;
  }
</script>

{#if loading}
  <p>Loading subjects...</p>
{:else}
  {#if error}
    <p style="color: red; font-weight: bold; font-size: 1.1em; margin-bottom: 1em;">{error}</p>
  {/if}
  {#if alreadyVoted}
    <div class="already-voted-msg">
      Již jste hlasoval(a) v této kategorii. Další hlasování není možné.
    </div>
  {:else}
    <h2>Seřaďte předměty podle preferencí ({type})</h2>
    <div class="drag-info">Přetáhněte předměty myší pro změnu pořadí, nebo použijte šipky.</div>
    <ul class="subject-list">
      {#each orderedSubjects as subject, i}
        <li
          class="subject-item"
          draggable="true"
          on:dragstart={() => handleDragStart(i)}
          on:dragover={(e) => handleDragOver(e, i)}
          on:drop={handleDrop}
        >
          <span class="order-num">{i + 1}.</span> {subject.name}
          <button on:click={() => i > 0 && ([orderedSubjects[i - 1], orderedSubjects[i]] = [orderedSubjects[i], orderedSubjects[i - 1]])} disabled={i === 0} title="Posunout výš">↑</button>
          <button on:click={() => i < orderedSubjects.length - 1 && ([orderedSubjects[i + 1], orderedSubjects[i]] = [orderedSubjects[i], orderedSubjects[i + 1]])} disabled={i === orderedSubjects.length - 1} title="Posunout níž">↓</button>
        </li>
      {/each}
    </ul>
    <button class="submit-btn" on:click={submitPreferences} disabled={submitting || alreadyVoted || !orderedSubjects || orderedSubjects.length === 0}>Odeslat preference</button>
  {/if}

  <style>
    .already-voted-msg {
      background: #ffe0e0;
      color: #a00;
      padding: 1em;
      border-radius: 6px;
      margin: 1em 0;
      font-size: 1.1em;
      text-align: center;
      border: 1px solid #f99;
    }
  </style>

  <style>
    .subject-list {
      list-style: none;
      padding: 0;
      max-width: 400px;
      margin: 1rem 0;
    }
    .subject-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #f6f6f6;
      border-radius: 6px;
      border: 1px solid #ddd;
      cursor: grab;
      transition: background 0.2s;
    }
    .subject-item:active {
      background: #e0e0e0;
    }
    .order-num {
      font-weight: bold;
      width: 2em;
      text-align: right;
    }
    .drag-info {
      font-size: 0.95em;
      color: #666;
      margin-bottom: 0.5em;
    }
    .submit-btn {
      margin-top: 1em;
      padding: 0.5em 1.5em;
      font-size: 1.1em;
      background: #2d7be5;
      color: #fff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .submit-btn:disabled {
      background: #aaa;
      cursor: not-allowed;
    }
  </style>
{/if}
