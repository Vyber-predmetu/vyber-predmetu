import { redirect } from '@sveltejs/kit'

export const load = async ({ parent }: { parent: () => Promise<any> }) => {
    const { session } = await parent()

    if (session) {
        throw redirect(303, '/dashboard')
    }

    throw redirect(303, '/auth/login')
}