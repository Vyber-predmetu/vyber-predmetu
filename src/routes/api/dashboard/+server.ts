import { json } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';

// API endpoint to fetch subjects by type and grade
export const GET = async ({ url }) => {
  const supabase = getServiceClient();
  const type = url.searchParams.get('type'); // 'OSE' or 'MVOP'
  const grade = Number(url.searchParams.get('grade'));
  console.log('DEBUG: GET /api/dashboard type:', type, 'grade:', grade);
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

// API endpoint to save user preferences
export const POST = async ({ request }) => {
  const supabase = getServiceClient();
  const body = await request.json();
  const { student_id, preferences } = body; // preferences: [{ subject_id, subject_order }]
  console.log('DEBUG: POST /api/dashboard student_id:', student_id, 'type:', typeof student_id);
  if (!student_id || !Array.isArray(preferences)) return json({ error: 'Missing data' }, { status: 400 });

  // Get type and grade from first subject in preferences
  let type = null;
  let grade = null;
  if (preferences.length > 0) {
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('type_of_subject, target_grade')
      .eq('id', preferences[0].subject_id)
      .single();
    if (subject && !subjectError) {
      type = subject.type_of_subject;
      grade = subject.target_grade;
    }
  }
  if (!type || !grade) return json({ error: 'Cannot determine subject type/grade' }, { status: 400 });

  // Get all subjects of this type/grade
  const { data: allSubjects, error: allSubjectsError } = await supabase
    .from('subjects')
    .select('id')
    .eq('type_of_subject', type)
    .eq('target_grade', grade);
  if (allSubjectsError) return json({ error: allSubjectsError.message }, { status: 500 });
  const subjectIds = allSubjects.map(s => s.id);
  if (!subjectIds.length) return json({ error: 'No subjects found for this type/grade.' }, { status: 400 });

  // Check if user already voted for any of these subjects
  const { data: existingVotes, error: existingVotesError } = await supabase
    .from('preferential_round')
    .select('id')
    .eq('student_id', student_id)
    .in('subject_id', subjectIds);
  if (existingVotesError) return json({ error: existingVotesError.message }, { status: 500 });
  if (existingVotes && existingVotes.length > 0) {
    return json({ error: 'Už jste hlasoval(a) pro tuto kategorii.' }, { status: 400 });
  }

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
  console.log('DEBUG: POST /api/dashboard inserts:', inserts);
  const { error } = await supabase
    .from('preferential_round')
    .insert(inserts);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ success: true });
};
