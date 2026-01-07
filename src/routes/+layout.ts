import { createBrowserClient } from '@supabase/ssr'
import { env } from '$env/dynamic/public'
import type { LayoutLoad } from './$types'

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
    depends('supabase:auth')
    const supabase = createBrowserClient(
        env.PUBLIC_SUPABASE_URL,
        env.PUBLIC_SUPABASE_ANON_KEY,
        {
            global: {
                fetch,
            }
        }
    )

    return {
        supabase,
        session: data.session,
        user: data.user
    }
}