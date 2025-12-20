import { redirect, fail } from '@sveltejs/kit'
import type { Actions } from './$types'

export const actions: Actions = {
    sendOtp: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData()
        const email = formData.get('email') as string

        if (!email) {
            return fail(400, { error: 'Email je povinný' })
        }

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false,
            },
        })

        if (error) {
            console.error('OTP error:', error)
            return fail(400, {
                error: 'Email nenalezen nebo problém s odesláním kódu.'
            })
        }

        return { success: true }
    },

    verifyOtp: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData()
        const email = formData.get('email') as string
        const token = formData.get('token') as string

        if (!email || !token) {
            return fail(400, { error: 'Email a kód jsou povinné' })
        }

        const { error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email',
        })

        if (error) {
            console.error('Verify error:', error)
            return fail(400, {
                error: 'Neplatný nebo expirovaný kód.'
            })
        }

        throw redirect(303, '/dashboard')
    },
}