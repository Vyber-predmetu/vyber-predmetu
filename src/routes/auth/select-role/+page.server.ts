import { redirect } from '@sveltejs/kit'
import { getServiceClient } from '$lib/supabase-service.server'
import type { ServerLoad } from '@sveltejs/kit'

export const load: ServerLoad = async ({ parent }) => {
	const { session, user } = await parent()

	if (!session || !user?.email) {
		throw redirect(303, '/auth/login')
	}

	const supabase = getServiceClient()

	// Najít uživatele v databázi
	const { data: dbUser, error: dbUserError } = await supabase
		.from('users')
		.select('id')
		.ilike('email', user.email)
		.single()

	if (dbUserError || !dbUser) {
		throw redirect(303, '/auth/login')
	}

	// Načíst všechny role uživatele
	const { data: userRoles, error: rolesError } = await supabase
		.from('user_roles')
		.select('role_id, roles(id, role_name)')
		.eq('user_id', dbUser.id)

	if (rolesError || !userRoles || userRoles.length === 0) {
		throw redirect(303, '/auth/login')
	}

	// Pokud má jen jednu roli, přesměrovat rovnou
	if (userRoles.length === 1) {
		const roleName = (userRoles[0].roles as any)?.role_name
		if (roleName === 'student') {
			throw redirect(303, '/student')
		} else if (roleName === 'teacher') {
			throw redirect(303, '/teacher')
		} else if (roleName === 'admin') {
			throw redirect(303, '/admin')
		}
	}

	// Připravit seznam rolí
	const roles = userRoles.map((ur) => ({
		id: (ur.roles as any)?.id,
		name: (ur.roles as any)?.role_name
	}))

	return {
		roles
	}
}
