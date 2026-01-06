
import { redirect } from '@sveltejs/kit'
import { getServiceClient } from '$lib/supabase-service.server'
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ parent }: { parent: () => Promise<any> }) => {
  const { session, user } = await parent()

  if (!session) {
    throw redirect(303, '/auth/login')
  }

  const supabase = getServiceClient()
  let canVote = false
  let votingWindow = null
  let votingMessage = ''
  let alreadyVotedTypes: string[] = []

  if (!user || !user.email) {
    return { user, canVote: false, votingMessage: 'Uživatel nenalezen.' }
  }

  const { data: dbUser, error: dbUserError } = await supabase
    .from('users')
    .select('id, graduation_year, email')
    .eq('email', user.email)
    .single()

  if (!dbUser || dbUserError) {
    return { user, canVote: false, votingMessage: 'Uživatel nenalezen.' }
  }

  const { data: userRolesRaw, error: userRolesRawError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', dbUser.id)
  console.log('DEBUG: userRolesRaw', userRolesRaw)
  if (userRolesRawError) console.log('DEBUG: userRolesRawError', userRolesRawError)

  const { data: allRoles, error: allRolesError } = await supabase
    .from('roles')
    .select('*')
  console.log('DEBUG: allRoles', allRoles)
  if (allRolesError) console.log('DEBUG: allRolesError', allRolesError)

  const studentRole = allRoles?.find(r => r.role_name === 'student')
  const hasStudentRole = !!userRolesRaw?.some(ur => ur.role_id === studentRole?.id)
  if (!hasStudentRole) {
    return { user, canVote: false, votingMessage: 'Pouze studenti mohou hlasovat.' }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let grade;
  if (currentMonth >= 8) {
    grade = currentYear + 1 - dbUser.graduation_year + 4;
  } else {
    grade = currentYear - dbUser.graduation_year + 4;
  }
  console.log('DEBUG: graduation_year:', dbUser.graduation_year, 'currentYear:', currentYear, 'currentMonth:', currentMonth, 'calculated grade:', grade);

  if (grade < 1 || grade > 4) {
    return { user, canVote: false, votingMessage: 'Ročník mimo rozsah.' }
  }

  let targetYear = null;
  if (grade >= 1 && grade <= 3) {
    targetYear = grade + 1;
  }
  if (grade === 4) {
    return {
      user: { ...user, id: user.id, db_id: dbUser.id },
      canVote: false,
      grade,
      votingMessage: 'Čtvrťáci si již žádné předměty nevolí.',
      published: false,
      subjects: [],
      subjectTypes: [],
      alreadyVotedTypes: [],
    };
  }

  const { data: window, error: windowError } = await supabase
    .from('voting_window')
    .select('voting_start, voting_end')
    .eq('target_year', targetYear)
    .single()

  canVote = false;
  votingWindow = null;
  votingMessage = '';
  if (!window || windowError) {
    votingMessage = 'Pro hlasování se vraťte později.';
  } else {
    const start = new Date(window.voting_start)
    const end = new Date(window.voting_end)
    if (now < start) {
      votingMessage = `Pro hlasování se vraťte později. Hlasování se otevře ${start.toLocaleString('cs-CZ')}`
    } else if (now > end) {
      votingMessage = `Hlasování je ukončeno, pokud jste nestihli hlasovat, kontaktujte admina.`
    }
    if (now >= start && now <= end) {
      canVote = true
      votingWindow = window
    }
  }
  
  const { data: publishData, error: publishError } = await supabase
    .from('subjects_published')
    .select('published')
    .single();
  let published = false;
  if (!publishError && publishData?.published) {
    published = true;
  }

  let subjects: Array<{ id: number; name: string; description: string; type_of_subject?: string; target_grade?: number }> = [];
  let subjectTypes: string[] = [];
  if (published) {
    const { data: divisionRows, error: divisionError } = await supabase
      .from('division_config')
      .select('subject_type')
      .eq('target_year', grade + 1);
    if (!divisionError && divisionRows) {
      subjectTypes = Array.from(new Set(divisionRows.map(row => row.subject_type)));
    }
    const { data: subjectData, error: subjectError } = await supabase
      .from('subjects')
      .select('id, name, description, type_of_subject, target_grade')
      .eq('target_grade', grade + 1)
      .order('name', { ascending: true });
    if (!subjectError && subjectData) {
      subjects = subjectData;
    }
    alreadyVotedTypes = [];
    for (const type of subjectTypes) {
      const { data: typeSubjects, error: typeSubjectsError } = await supabase
        .from('subjects')
        .select('id')
        .eq('type_of_subject', type)
        .eq('target_grade', grade + 1);
      if (typeSubjectsError) continue;
      const subjectIds = typeSubjects.map(s => s.id);
      if (!subjectIds.length) continue;
      // Check if user already voted for any of these subjects
      const { data: votes, error: votesError } = await supabase
        .from('preferential_round')
        .select('id')
        .eq('student_id', dbUser.id)
        .in('subject_id', subjectIds)
        .limit(1);
      if (!votesError && votes && votes.length > 0) {
        alreadyVotedTypes.push(type);
      }
    }
    if (subjectTypes.length > 0 && alreadyVotedTypes.length === subjectTypes.length) {
      canVote = false;
      votingMessage = 'Již jste hlasoval(a) ve všech kategoriích.';
    }
  }

  return {
    user: { ...user, id: user.id, db_id: dbUser.id },
    canVote,
    votingWindow,
    grade,
    targetYear,
    votingMessage,
    published,
    subjects,
    subjectTypes,
    alreadyVotedTypes,
  }
}