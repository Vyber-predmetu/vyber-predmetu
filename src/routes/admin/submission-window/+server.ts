import { json } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
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

	const body = await request.json();
	const { start: startStr, end: endStr } = body;

	if (!startStr || !endStr) {
		return json({ error: 'Vyplňte oba časy.' }, { status: 400 });
	}

	const start = new Date(startStr);
	const end = new Date(endStr);
	if (end <= start) {
		return json({ error: 'Konec musí být po začátku.' }, { status: 400 });
	}

	// Check if a submission window already exists
	const { data: existing } = await supabase
		.from('submission_window')
		.select('id')
		.order('id', { ascending: false })
		.limit(1)
		.single();

	let result;
	if (existing) {
		// Update the existing row
		const { data, error } = await supabase
			.from('submission_window')
			.update({ start: start.toISOString(), end: end.toISOString() })
			.eq('id', existing.id)
			.select('id, start, end')
			.single();
		if (error) return json({ error: error.message }, { status: 500 });
		result = data;
	} else {
		// Insert a new row
		const { data, error } = await supabase
			.from('submission_window')
			.insert({ start: start.toISOString(), end: end.toISOString() })
			.select('id, start, end')
			.single();
		if (error) return json({ error: error.message }, { status: 500 });
		result = data;
	}

	return json({ success: true, submissionWindow: result });
};
