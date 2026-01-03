import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env variable')
}

export const getServiceClient = () =>
    createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
