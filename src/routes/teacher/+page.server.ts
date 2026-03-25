import { redirect } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ parent }) => {
	const { session, user } = await parent();

	if (!session) {
		throw redirect(303, '/auth/login');
	}

	const supabase = getServiceClient();
	const { data: dbUser } = await supabase
		.from('users')
		.select('id')
		.ilike('email', user.email)
		.single();

	if (!dbUser) {
		throw redirect(303, '/auth/login');
	}

	const { data: userRoles } = await supabase
		.from('user_roles')
		.select('role_id, roles(role_name)')
		.eq('user_id', dbUser.id);

	const hasTeacherRole = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'teacher');

	if (!hasTeacherRole) {
		throw redirect(303, '/auth/login');
	}

	const { data: submissionWindow } = await supabase
		.from('submission_window')
		.select('start, end')
		.order('id', { ascending: false })
		.limit(1)
		.single();

	const { data: subjects } = await supabase
		.from('subjects')
		.select('*')
		.eq('teacher_id', dbUser.id)
		.order('created_at', { ascending: false });

	const subjectIds = (subjects ?? []).map((s) => s.id);
	let enrollmentsBySubject: Record<number, { first_name: string; last_name: string }[]> = {};
	if (subjectIds.length > 0) {
		const { data: enrollments } = await supabase
			.from('student_enrollment')
			.select('subject_id, student_id')
			.in('subject_id', subjectIds);
		if (enrollments && enrollments.length > 0) {
			const studentIds = [...new Set(enrollments.map((e) => e.student_id))];
			const { data: students } = await supabase
				.from('users')
				.select('id, first_name, last_name')
				.in('id', studentIds);
			const studentMap = new Map(
				(students ?? []).map((s) => [s.id, { first_name: s.first_name, last_name: s.last_name }])
			);
			for (const e of enrollments) {
				if (!enrollmentsBySubject[e.subject_id]) enrollmentsBySubject[e.subject_id] = [];
				const student = studentMap.get(e.student_id);
				if (student) enrollmentsBySubject[e.subject_id].push(student);
			}
		}
	}

	return {
		user,
		submissionWindow,
		subjects,
		enrollmentsBySubject
	};
};

import { fail } from '@sveltejs/kit';
export const actions = {
	addSubject: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session) {
			throw redirect(303, '/auth/login');
		}
		const form = await request.formData();
		const name = (form.get('name') || '').toString().trim();
		const description = (form.get('description') || '').toString().trim();
		const target_grade = form.get('target_grade');
		const subject_type = form.get('type_of_subject');

		if (!name || !description || !target_grade || !subject_type) {
			return fail(400, { error: 'Všechna pole jsou povinná.' });
		}
		if (subject_type === 'MVOP' && target_grade !== '3') {
			return fail(400, { error: 'MVOP předmět může být pouze pro 3. ročník.' });
		}

		const supabase = getServiceClient();
		const { data: dbUser } = await supabase
			.from('users')
			.select('id')
			.ilike('email', user.email)
			.single();
		if (!dbUser) {
			throw redirect(303, '/auth/login');
		}

		const { data: existing } = await supabase
			.from('subjects')
			.select('id')
			.eq('name', name)
			.eq('target_grade', target_grade)
			.maybeSingle();
		if (existing) {
			return fail(400, { error: 'Předmět s tímto názvem pro tento ročník již existuje.' });
		}

		const { data: inserted, error } = await supabase
			.from('subjects')
			.insert({
				teacher_id: dbUser.id,
				target_grade,
				name,
				description,
				subject_type
			})
			.select()
			.single();
		if (error) {
			let msg = error.message;
			if (msg.includes('duplicate key value') || msg.includes('already exists')) {
				msg = 'Předmět s tímto názvem již existuje.';
			}
			return fail(400, { error: msg });
		}
		return { success: true, subject: inserted };
	}
};
