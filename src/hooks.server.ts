import { env } from "$env/dynamic/public";
import { createServerClient } from "@supabase/ssr";
import { error, type Handle } from "@sveltejs/kit";
import type { Session, User } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    "http://136.244.82.220:3000",
    "https://stp.ataeva.cz",
];

const csrfGuard: Handle = ({ event, resolve }) => {
    const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(event.request.method);
    if (isMutating) {
        const origin = event.request.headers.get("origin");
        if (origin && !ALLOWED_ORIGINS.includes(origin)) {
            error(403, "Cross-site POST form submissions are forbidden");
        }
    }
    return resolve(event);
};

const supabaseHandle: Handle = ({ event, resolve }) => {
    event.locals.supabase = createServerClient(
        env.PUBLIC_SUPABASE_URL,
        env.PUBLIC_SUPABASE_ANON_KEY,
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
};

export const handle: Handle = ({ event, resolve }) =>
    csrfGuard({ event, resolve: (e) => supabaseHandle({ event: e, resolve }) });
