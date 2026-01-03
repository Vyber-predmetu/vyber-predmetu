import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from "$env/static/public";
import { createServerClient } from "@supabase/ssr";
import type { Handle } from "@sveltejs/kit";
import type { Session, User } from '@supabase/supabase-js';

export const handle: Handle = ({ event, resolve }) => {
    event.locals.supabase = createServerClient(
        PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return event.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        event.cookies.set(name, value, { ...options, path: '/' })
                    })
                },
            },
        }
    )
    event.locals.safeGetSession = async () => {
        try {
            const {
                data: { session },
            } = await event.locals.supabase.auth.getSession()

            if (!session) {
                return { session: null, user: null }
            }

            const {
                data: { user },
                error,
            } = await event.locals.supabase.auth.getUser()

            if (error) {
                console.error('safeGetSession: getUser error', error)
                return { session: null, user: null }
            }

            // Put the validated user into the returned session to avoid exposing the original proxied session.user
            const safeSession = { ...session, user } as Session

            return { session: safeSession, user }
        } catch (err) {
            console.error('safeGetSession: unexpected error', err)
            return { session: null, user: null }
        }
    }

    return resolve(event)
}