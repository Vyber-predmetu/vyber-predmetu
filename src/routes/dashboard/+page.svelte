<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'

  export let data: PageData
</script>

<div class="container">
  <h1>Dashboard</h1>
  
  <div class="user-info">
    <p>Přihlášen jako:</p>
    <p class="email">{data.user?.email}</p>
    <p class="user-id">ID: {data.user?.id}</p>
  </div>

  <form 
    method="POST" 
    action="/auth/logout" 
    use:enhance={() => {
      return async ({ update }) => {
        await invalidate('supabase:auth')
        await update()
      }
    }}
  >
    <button type="submit">Odhlásit se</button>
  </form>
</div>