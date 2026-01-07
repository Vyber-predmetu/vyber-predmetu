import { json } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';

export const GET = async ({ url }) => {
  const supabase = getServiceClient();
  const student_id = url.searchParams.get('student_id');
  const type = url.searchParams.get('type');
  const grade = Number(url.searchParams.get('grade'));
  if (!student_id || !type || !grade) return json({ error: 'Missing params' }, { status: 400 });
  const { data, error } = await supabase
    .from('preferential_round')
    .select('id')
    .eq('student_id', student_id)
    .limit(1);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ alreadyVoted: data.length > 0 });
};
