
import { redirect } from '@sveltejs/kit'
import { getServiceClient } from '$lib/supabase-service.server'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { session, user } = await parent()

  if (!session) {
    throw redirect(303, '/auth/login')
  }

  // Ověření hlasovacího práva studenta podle user_roles
  const supabase = getServiceClient()
  let canVote = false
  let votingWindow = null
  let votingMessage = ''

  // Získání uživatele podle emailu
  const { data: dbUser, error: dbUserError } = await supabase
    .from('users')
    .select('id, graduation_year, email')
    .eq('email', user.email)
    .single()

  if (!dbUser || dbUserError) {
    return { user, canVote: false, votingMessage: 'Uživatel nenalezen.' }
  }



  // Získání všech user_roles a všech roles
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

  // Ověření role studenta ručně
  const studentRole = allRoles?.find(r => r.role_name === 'student')
  const hasStudentRole = !!userRolesRaw?.some(ur => ur.role_id === studentRole?.id)
  if (!hasStudentRole) {
    return { user, canVote: false, votingMessage: 'Pouze studenti mohou hlasovat.' }
  }

  // Vypočítat ročník studenta podle začátku školního roku (září)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 = leden, 8 = září
  let grade;
  if (currentMonth >= 8) { // září až prosinec
    grade = dbUser.graduation_year - currentYear + 1;
  } else { // leden až srpen
    grade = dbUser.graduation_year - currentYear;
  }

  if (grade < 1 || grade > 3) {
    return { user, canVote: false, votingMessage: 'Čtvrtý ročník nehlasuje.' }
  }

  const targetYear = grade + 1

  const { data: window, error: windowError } = await supabase
    .from('voting_window')
    .select('voting_start, voting_end')
    .eq('target_year', targetYear)
    .single()

  if (!window || windowError) {
    return { user, canVote: false, votingMessage: 'Hlasovací okno není nastaveno.' }
  }

  const start = new Date(window.voting_start)
  const end = new Date(window.voting_end)
  if (now < start) {
    votingMessage = `Je příliš brzy, hlasování se otevře ${start.toLocaleString('cs-CZ')}`
  } else if (now > end) {
    votingMessage = `Hlasování je ukončeno, pokud jste nestihli hlasovat, kontaktujte admina.`
  }
  if (now >= start && now <= end) {
    canVote = true
    votingWindow = window
  }

  return {
    user,
    canVote,
    votingWindow,
    grade,
    targetYear,
    votingMessage,
  }
}