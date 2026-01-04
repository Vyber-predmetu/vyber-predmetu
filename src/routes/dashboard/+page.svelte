<script lang="ts">
  import { invalidate, goto } from '$app/navigation'
  import type { PageData } from './$types.d.ts'

  export let data: PageData


  let loggingOut = false
  let subjects = data.subjects ?? [];
  let showMoreArr: boolean[] = Array(subjects.length).fill(false);

  async function handleLogout() {
    loggingOut = true
    console.debug('handleLogout: initiating')
    try {
      const res = await fetch('/auth/logout', { method: 'POST' })
      let data = null
      try { data = await res.json() } catch (e) { }
      console.debug('handleLogout: response', res.status, data)

      if (res.ok) {
        await invalidate('supabase:auth')
        goto('/auth/login')
        return
      }

      console.error('handleLogout: failed', res.status, data)
      alert('Odhlášení selhalo. Zkuste to znovu.')
    } catch (e) {
      console.error('handleLogout: exception', e)
      alert('Chyba při odhlašování. Zkuste to znovu.')
    } finally {
      loggingOut = false
    }
  }
</script>

<div class="container">
  <h1>Dashboard</h1>
  
  <div class="user-info">
    <p>Přihlášen jako:</p>
    <p class="email">{data.user?.email}</p>
    <p class="user-id">ID: {data.user?.id}</p>
  </div>

  <div>
    <button type="button" on:click={handleLogout} disabled={loggingOut}>
      {loggingOut ? 'Odhlášuji...' : 'Odhlásit se'}
    </button>
  </div>

  {#if !data.published}
    <div class="voting-info">
      <p>Je příliš brzy, předměty nejsou zveřejněny.</p>
    </div>
  {:else}
    <div class="subjects-grid">
      <h2>Předměty pro Váš ročník</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
        {#each subjects as subject, i (subject.id)}
          <div class="subject-card" style="border: 1px solid #ccc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <strong>{subject.name}</strong>
            <div><em>{subject.type_of_subject}</em></div>
            <div>
              {#if subject.description.length > 120}
                <span>{showMoreArr[i] ? subject.description : subject.description.slice(0, 120) + '...'}</span>
                <button on:click={() => showMoreArr[i] = !showMoreArr[i]}>
                  {showMoreArr[i] ? 'Skrýt' : 'Zobrazit více'}
                </button>
              {:else}
                <span>{subject.description}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
    {#if data.votingWindow}
      <div class="voting-cta">
        <button type="button" on:click={() => goto('/voting')} disabled={!data.canVote}>Zvolit předměty</button>
        <p>
          Hlasování je otevřeno do
          {new Date(data.votingWindow.voting_end).toLocaleString('cs-CZ')}
        </p>
      </div>
    {/if}
    {#if data.votingMessage}
      <div class="voting-info">
        <p>{data.votingMessage}</p>
      </div>
    {/if}
  {/if}
</div>