<script lang="ts">
    import { enhance } from '$app/forms'
    import { send } from 'process';
    import type { ActionData } from './$types'
	import { error } from '@sveltejs/kit';

    export let form: ActionData

    let step: 'email' | 'otp' = 'email'
    let email = ''
    let loading = false
</script>

<article>
    <h1>Přihlášení do systému výběru MVOP a OSE</h1>

    {#if step === 'email'}
        <form
            method="POST"
            action="?/sendOtp"
            use:enhance={() => {
                loading = true

                return async ({ result, update }) => {
                    loading = false

                    if (result.type === 'success'){
                        step = 'otp'
                    }
                    
                    await update();
                }
            }}
        >
            <label for="">
                Email:
                <input 
                    type="email" 
                    name="email"
                    bind:value={email}
                    required
                    placeholder="xxxxx@skola.ssps.cz"
                    disabled={loading}
                />
            </label>

            {#if form?.error}
                <p class="error">{form.error}</p>
            {/if}

            <button type="submit" disabled={loading}>
                {loading ? 'Odesílám kód...' : 'Odeslat kód'}
            </button>
        </form>
    {:else}
        <p class="info">
            Kód byl odeslán na email: <strong>{email}</strong>
        </p>
        <form
            method="POST"
            action="?/verifyOtp"
            use:enhance={() => {
                loading = true

                return async ({ update }) => {
                    loading = false
                    await update();
                }
            }}
        >
            <input type="hidden" name="email" value={email}>

            <label>
                6místný kód:
                <input 
                    type="text" 
                    name="token" 
                    required 
                    maxlength="6"
                    minlength="6"
                    pattern="[0-9]{6}"
                    placeholder="123456"
                    disabled={loading}
                    autocomplete="one-time-code"
                />
            </label>
            {#if form?.error}
                <p class="error">{form.error}</p>
            {/if}
            <section class="button-group">
                <button type="submit" disabled={loading}>
                    {loading ? 'Ověřuji...' : 'Přihlásit se'}
                </button>
        
                <button 
                    type="button" 
                    on:click={() => { step = 'email'; form = null }}
                    disabled={loading}
                    class="secondary"
                >
                    Zpět
                </button>
            </section>
        </form>
    {/if}
</article>