import { json } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';
import type { RequestHandler } from './$types';

const VALID_STATES = ['waitlisted', 'accepted', 'rejected'];

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { subject_id, state } = body;

	if (!subject_id || !state || !VALID_STATES.includes(state)) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	const supabase = getServiceClient();

	const { data: dbUser } = await supabase
		.from('users')
		.select('id')
		.ilike('email', session.user.email ?? '')
		.single();

	if (!dbUser) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	const { data: userRoles } = await supabase
		.from('user_roles')
		.select('role_id, roles(role_name)')
		.eq('user_id', dbUser.id);

	const hasAdminRole = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'admin');
	if (!hasAdminRole) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { error } = await supabase.from('subjects').update({ state }).eq('id', subject_id);

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ success: true });
};
