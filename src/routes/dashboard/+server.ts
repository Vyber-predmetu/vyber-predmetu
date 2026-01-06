import { json } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';

export const GET = async ({ url }) => {
  const supabase = getServiceClient();
  const type = url.searchParams.get('type'); // 'OSE' or 'MVOP'
  const grade = Number(url.searchParams.get('grade'));
  console.log('DEBUG: GET /dashboard type:', type, 'grade:', grade);
  if (!type || !grade) {
    console.log('DEBUG: Missing type or grade', { type, grade });
    return json({ error: 'Missing type or grade' }, { status: 400 });
  }
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('id, name, type_of_subject, target_grade')
    .eq('type_of_subject', type)
    .eq('target_grade', grade + 1);
  console.log('DEBUG: subjects query result', subjects, 'error:', error);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ subjects });
};

export const POST = async ({ request }) => {
  const supabase = getServiceClient();
  const body = await request.json();
  const { student_id, preferences } = body; // preferences: [{ subject_id, subject_order }]
  console.log('DEBUG: POST /dashboard student_id:', student_id, 'type:', typeof student_id);
  if (!student_id || !Array.isArray(preferences)) return json({ error: 'Missing data' }, { status: 400 });
  // Insert all preferences
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  const inserts = preferences.map(pref => ({
    id: uuidv4(),
    student_id,
    subject_id: pref.subject_id,
    subject_order: pref.subject_order
  }));
  console.log('DEBUG: POST /dashboard inserts:', inserts);
  const { error } = await supabase
    .from('preferential_round')
    .insert(inserts);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ success: true });
};
