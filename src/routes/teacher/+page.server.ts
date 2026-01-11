import { redirect } from '@sveltejs/kit'
import type { ServerLoad } from '@sveltejs/kit'

export const load: ServerLoad = async ({ parent }) => {
	const { session, user } = await parent()

	if (!session) {
		throw redirect(303, '/auth/login')
	}

	return {
		user
	}
}
