<script lang="ts">
    import { enhance } from '$app/forms'
    import { onMount } from 'svelte'
    import type { ActionData } from './$types'
	import { error } from '@sveltejs/kit';

    export let form: ActionData

    let step: 'email' | 'otp' = 'email'
    let email = ''
    let token = ''
    let loading = false

    onMount(() => {
        try {
            const stored = localStorage.getItem('otp_email')
            if (stored) email = stored
        } catch (e) {
        }
    })
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
                        try { localStorage.setItem('otp_email', email) } catch (e) {}
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
            on:submit={() => {
                try {
                    const hidden = document.querySelector('input[name="email"]') as HTMLInputElement
                    const stored = (email && email.trim()) || (localStorage.getItem('otp_email') || '')
                    if (hidden) {
                        hidden.value = stored
                    }
                    console.debug('verify form submit - email value set to', stored)
                } catch (e) {
                    console.debug('verify submit: could not set hidden email', e)
                }
            }}
            use:enhance={() => {
                loading = true

                return async ({ update }) => {
                    loading = false
                    await update();
                }
            }}
        >
            <input type="hidden" name="email" bind:value={email}>

            <label>
                6místný kód:
                <input 
                    type="text" 
                    name="token" 
                    bind:value={token}
                    required 
                    maxlength="6"
                    inputmode="numeric"
                    placeholder="123456"
                    disabled={loading}
                    autocomplete="one-time-code"
                    on:input={() => { token = token.replace(/\D/g, '').slice(0,6) }}
                />
            </label>

            {#if token && token.length !== 6}
                <p class="error">Kód musí obsahovat přesně 6 číslic.</p>
            {/if}
            {#if form?.error}
                <p class="error">{form.error}</p>
            {/if}
            <section class="button-group">
                <button type="submit" disabled={loading || token.length !== 6}>
                    {loading ? 'Ověřuji...' : 'Přihlásit se'}
                </button>
        
                <button 
                    type="button" 
                    on:click={() => { step = 'email'; form = null; token = ''; try { localStorage.removeItem('otp_email') } catch (e) {} }}
                    disabled={loading}
                    class="secondary"
                >
                    Zpět
                </button>
            </section>
        </form>
    {/if}
</article>