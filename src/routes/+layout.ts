import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from "$env/static/public";
import { createBrowserClient, isBrowser, parseCookieHeader } from "@supabase/ssr";
import { type LayoutLoad } from "./$types";



export const load: LayoutLoad = async ({ fetch, data, depends }) => {
    depends('supabase:auth')
    const supabase =


    return {}
}