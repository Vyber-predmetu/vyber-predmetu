import { redirect, fail } from '@sveltejs/kit'
import type { Actions } from './$types'
import { getServiceClient } from '$lib/supabase-service.server'

export const actions: Actions = {
    sendOtp: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData()
        const emailRaw = formData.get('email') as string
        const email = (emailRaw || '').trim()

        if (!email) {
            return fail(400, { error: 'Email je povinný' })
        }

        const normalized = email.toLowerCase()
        console.debug('Checking user for email:', normalized)

        const svc = getServiceClient()
        const { data: existingUser, error: dbError } = await svc
            .from('users')
            .select('id')
            .ilike('email', normalized)
            .limit(1)
            .maybeSingle()

        if (dbError) {
            console.error('DB error (service role):', dbError)
            return fail(500, { error: 'Interní chyba databáze.' })
        }

        console.debug('existingUser result:', existingUser)

        if (!existingUser) {
            return fail(400, { error: 'Email není povolený.' })
        }

        console.debug('Sending OTP via supabase.auth (server client) for', email)
        const { data: otpData, error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false,
            },
        })

        if (error) {
            console.error('OTP error:', error)
            const msg = (error?.message || '').toString()
            const code = (error as any)?.code
            console.error('OTP error details:', { status: (error as any)?.status, code, msg })

            if (code === 'otp_disabled' || msg.toLowerCase().includes('signups not allowed')) {
                console.debug('otp_disabled detected — attempting to provision auth user via service role')
                const svc = getServiceClient()

                try {
                    const { data: createdUser, error: createErr } = await svc.auth.admin.createUser({
                        email,
                        email_confirm: true,
                        user_metadata: { provisioned_by: 'provision-on-otp' }
                    })

                    if (createErr) {
                        console.error('Failed to create auth user via service role:', createErr)
                        return fail(500, { error: 'Chyba při provisioning uživatele. Kontaktujte administrátora.' })
                    }

                    console.debug('Created auth user for email:', createdUser)

                    const { data: otpData2, error: error2 } = await supabase.auth.signInWithOtp({
                        email,
                        options: { shouldCreateUser: false }
                    })

                    if (error2) {
                        console.error('Retry OTP error after creating auth user:', error2)
                        if (import.meta.env.DEV) {
                            return fail(400, { error: `Retry OTP error: ${(error2 as any)?.message || error2}` })
                        }
                        return fail(400, { error: 'Nepodařilo se odeslat kód ani po provizorním vytvoření uživatele.' })
                    }

                    console.debug('OTP send result after provisioning:', otpData2)
                    return { success: true }
                } catch (e) {
                    console.error('Exception during provisioning flow:', e)
                    return fail(500, { error: 'Interní chyba při ověřování uživatele.' })
                }
            }

            if (msg.toLowerCase().includes('user') || msg.toLowerCase().includes('not found')) {
                return fail(400, { error: 'Email není zaregistrován pro přihlášení. Kontaktujte administrátora.' })
            }

            if (msg.toLowerCase().includes('smtp') || msg.toLowerCase().includes('send') || msg.toLowerCase().includes('email')) {
                if (import.meta.env.DEV) {
                    return fail(400, { error: `Chyba odeslání e-mailu: ${msg}` })
                }
                return fail(400, { error: 'Problém s odesláním kódu (e-mailový server).' })
            }

            if (import.meta.env.DEV) {
                return fail(400, { error: `OTP error: ${msg}` })
            }

            return fail(400, {
                error: 'Problém s odesláním kódu.'
            })
        }

        console.debug('OTP send result:', otpData)

        return { success: true }
    },

    verifyOtp: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData()
        const emailRaw = (formData.get('email') as string) || ''
        const email = emailRaw.trim()
        const rawToken = (formData.get('token') as string) || ''
        const token = rawToken.replace(/\D/g, '')

        if (!email || !token) {
            console.debug('verifyOtp: missing fields', { emailRaw, email, rawToken, token })
            return fail(400, { error: 'Email a kód jsou povinné' })
        }

        if (token.length !== 6) {
            return fail(400, { error: 'Kód musí obsahovat přesně 6 číslic.' })
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

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            await supabase.auth.signOut()
            return fail(403, { error: 'Uživatel není povolený.' })
        }

        const userEmail = (user.email || '').trim().toLowerCase()
        console.debug('Verifying logged-in user email:', userEmail)

        const svc = getServiceClient()
        const { data: existingUser, error: dbError } = await svc
            .from('users')
            .select('id')
            .ilike('email', userEmail)
            .limit(1)
            .maybeSingle()

        if (dbError) {
            console.error('DB error (service role):', dbError)
            await supabase.auth.signOut()
            return fail(500, { error: 'Interní chyba databáze.' })
        }

        console.debug('existingUser result after verify:', existingUser)

        if (!existingUser) {
            await supabase.auth.signOut()
            return fail(403, { error: 'Účet není povolený.' })
        }

        const { data: userRoles, error: rolesError } = await svc
            .from('user_roles')
            .select('role_id, roles(role_name)')
            .eq('user_id', existingUser.id)

        if (rolesError) {
            console.error('Error fetching user roles:', rolesError)
            await supabase.auth.signOut()
            return fail(500, { error: 'Chyba při načítání rolí.' })
        }

        if (!userRoles || userRoles.length === 0) {
            await supabase.auth.signOut()
            return fail(403, { error: 'Uživatel nemá přiřazenou žádnou roli.' })
        }

        if (userRoles.length > 1) {
            throw redirect(303, '/auth/select-role')
        }

        const roleName = (userRoles[0].roles as any)?.role_name
        
        if (roleName === 'student') {
            throw redirect(303, '/student')
        } else if (roleName === 'teacher') {
            throw redirect(303, '/teacher')
        } else if (roleName === 'admin') {
            throw redirect(303, '/admin')
        }

        throw redirect(303, '/student')
    },
}