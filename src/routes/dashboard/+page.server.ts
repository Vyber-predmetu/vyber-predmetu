
import { redirect } from '@sveltejs/kit'
import { getServiceClient } from '$lib/supabase-service.server'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { session, user } = await parent()

  if (!session) {
    throw redirect(303, '/auth/login')
  }

  const supabase = getServiceClient()
  let canVote = false
  let votingWindow = null
  let votingMessage = ''

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
  const schoolYear = currentMonth >= 8 ? currentYear : currentYear - 1;
  let grade = dbUser.graduation_year - schoolYear + 1;
  console.log('DEBUG: graduation_year:', dbUser.graduation_year, 'currentYear:', currentYear, 'currentMonth:', currentMonth, 'schoolYear:', schoolYear, 'calculated grade:', grade);

  if (grade < 1 || grade > 3) {
    return { user, canVote: false, votingMessage: 'Čtvrtý ročník nehlasuje.' }
  }

  const targetYear = grade + 1

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
  }

  return {
    user,
    canVote,
    votingWindow,
    grade,
    targetYear,
    votingMessage,
    published,
    subjects,
    subjectTypes,
  }
}