<script lang="ts">
  import { invalidate, goto } from '$app/navigation'
  import type { PageData } from './$types'

  export let data: PageData

  let loggingOut = false

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
</div>