import { supabase } from '../lib/supabase'

export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0]

  const [doctorsRes, patientsRes, appointmentsRes, todayRes] = await Promise.all([
    supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'PATIENT'),
    supabase.from('appointments').select('id', { count: 'exact', head: true }),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('appointment_date', today)
  ])

  return {
    totalDoctors: doctorsRes.count ?? 0,
    totalPatients: patientsRes.count ?? 0,
    totalAppointments: appointmentsRes.count ?? 0,
    todayAppointments: todayRes.count ?? 0
  }
}

export async function getAllPatients() {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('role', 'PATIENT').order('name')
  if (error) throw error
  return data ?? []
}

export async function createDoctorAccount({ email, password, name, phone, specialization, qualification, experience_years, consultation_fee, department_id }) {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { name, phone, role: 'DOCTOR' }
  })
  if (authError) {
    // Fallback: use signUp if admin API not available
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, phone, role: 'DOCTOR' } }
    })
    if (signUpError) throw signUpError
    return signUpData
  }

  // 2. Create doctor profile record
  const userId = authData.user.id
  const { error: docError } = await supabase.from('doctors').insert([{
    user_id: userId, specialization, qualification,
    experience_years: experience_years ?? 0,
    consultation_fee: consultation_fee ?? 0,
    department_id: department_id || null,
    is_active: true
  }])
  if (docError) throw docError

  return authData
}

export async function deactivateDoctor(doctorId) {
  const { data, error } = await supabase
    .from('doctors').update({ is_active: false }).eq('id', doctorId).select().single()
  if (error) throw error
  return data
}

export async function activateDoctor(doctorId) {
  const { data, error } = await supabase
    .from('doctors').update({ is_active: true }).eq('id', doctorId).select().single()
  if (error) throw error
  return data
}

export async function updateDepartment(id, updates) {
  const { data, error } = await supabase
    .from('departments').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function createDepartment({ name, code }) {
  const { data, error } = await supabase
    .from('departments').insert([{ name, code }]).select().single()
  if (error) throw error
  return data
}

export async function getAppointmentReport(filters = {}) {
  let query = supabase
    .from('appointments')
    .select(`*, profiles:patient_id (name, phone, email), doctors (specialization, profiles:user_id (name))`)
    .order('appointment_date', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.from_date) query = query.gte('appointment_date', filters.from_date)
  if (filters.to_date) query = query.lte('appointment_date', filters.to_date)
  if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getWeeklyAppointmentTrend() {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }

  const { data, error } = await supabase
    .from('appointments').select('appointment_date, status')
    .gte('appointment_date', dates[0])
    .lte('appointment_date', dates[6])

  if (error) throw error

  const trend = dates.map(date => ({
    date,
    total: (data ?? []).filter(a => a.appointment_date === date).length,
    completed: (data ?? []).filter(a => a.appointment_date === date && a.status === 'COMPLETED').length,
    cancelled: (data ?? []).filter(a => a.appointment_date === date && a.status === 'CANCELLED').length
  }))

  return trend
}
