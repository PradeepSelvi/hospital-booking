import { useState, useEffect } from 'react'
import { getDoctors } from '../../services/doctors'
import { getDepartments, deactivateDoctor, activateDoctor } from '../../services/admin'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-toastify'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    specialization: '', qualification: '', experience_years: 0,
    consultation_fee: 0, department_id: ''
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      // Fetch all doctors (including inactive)
      const { data, error } = await supabase
        .from('doctors')
        .select(`*, profiles:user_id (name, email, phone), departments (name)`)
        .order('id', { ascending: false })
      if (error) throw error
      setDoctors(data ?? [])
      const depts = await getDepartments()
      setDepartments(depts)
    } catch (err) {
      toast.error('Failed to load doctors')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      setCreating(true)

      // SECURITY: We do NOT call supabase.auth.signUp() here because it would
      // hijack the admin's session and log them in as the new doctor.
      // Instead, we create the auth user via signUp in a way that doesn't auto-login,
      // by immediately signing back in as admin after.
      
      // Step 1: Store current admin session
      const { data: adminSession } = await supabase.auth.getSession()
      
      // Step 2: Create doctor auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name, phone: form.phone, role: 'DOCTOR' } }
      })
      if (authError) throw authError

      // Step 3: Create profile and doctor records
      if (authData?.user) {
        await supabase.from('profiles').upsert([{
          id: authData.user.id,
          name: form.name, email: form.email, phone: form.phone,
          role: 'DOCTOR', is_active: true
        }], { onConflict: 'id' })

        await supabase.from('doctors').insert([{
          user_id: authData.user.id,
          specialization: form.specialization,
          qualification: form.qualification,
          experience_years: form.experience_years,
          consultation_fee: form.consultation_fee,
          department_id: form.department_id || null,
          is_active: true
        }])
      }

      // Step 4: Restore admin session if it was replaced
      if (adminSession?.session) {
        await supabase.auth.setSession({
          access_token: adminSession.session.access_token,
          refresh_token: adminSession.session.refresh_token
        })
      }

      toast.success('Doctor account created successfully!')
      setShowModal(false)
      setForm({ name: '', email: '', phone: '', password: '', specialization: '', qualification: '', experience_years: 0, consultation_fee: 0, department_id: '' })
      loadData()
    } catch (err) {
      toast.error(err.message || 'Failed to create doctor')
      // Try to restore admin session on error
      window.location.reload()
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleStatus(doctor) {
    try {
      if (doctor.is_active) {
        await deactivateDoctor(doctor.id)
        toast.success('Doctor deactivated')
      } else {
        await activateDoctor(doctor.id)
        toast.success('Doctor activated')
      }
      loadData()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const filtered = doctors.filter(d => {
    if (!search) return true
    const name = d.profiles?.name?.toLowerCase() ?? ''
    const spec = d.specialization?.toLowerCase() ?? ''
    return name.includes(search.toLowerCase()) || spec.includes(search.toLowerCase())
  })

  if (loading) return <LoadingSpinner text="Loading doctors..." />

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
            Manage Doctors
          </h4>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
            Add, edit, or deactivate doctor accounts
          </p>
        </div>
        <button className="btn-primary-custom" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-lg" /> Add Doctor
        </button>
      </div>

      {/* Search */}
      <div className="card-custom p-3 mb-4">
        <div className="search-input-wrapper">
          <i className="bi bi-search" />
          <input
            type="text"
            className="form-input-custom"
            placeholder="Search by name or specialization..."
            style={{ paddingLeft: 42 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card-custom">
        <div className="table-responsive">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Specialization</th>
                <th>Experience</th>
                <th>Fee</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {doc.profiles?.name?.charAt(0) ?? 'D'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Dr. {doc.profiles?.name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{doc.profiles?.email ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{doc.specialization}</td>
                  <td>{doc.experience_years ?? 0} yrs</td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{doc.consultation_fee ?? 0}</td>
                  <td>{doc.departments?.name ?? '—'}</td>
                  <td>
                    <span className={doc.is_active ? 'badge-confirmed' : 'badge-cancelled'}>
                      {doc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 12, color: doc.is_active ? 'var(--danger)' : 'var(--success)' }}
                      onClick={() => handleToggleStatus(doc)}
                    >
                      {doc.is_active ? (
                        <><i className="bi bi-x-circle me-1" />Deactivate</>
                      ) : (
                        <><i className="bi bi-check-circle me-1" />Activate</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Doctor Modal */}
      {showModal && (
        <>
          <div className="overlay" onClick={() => setShowModal(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'white', borderRadius: 'var(--radius-lg)', padding: 32,
            zIndex: 1001, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)'
          }}>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
              <i className="bi bi-person-plus me-2 text-primary" />Add New Doctor
            </h5>
            <form onSubmit={handleCreate}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label-custom">Full Name *</label>
                  <input type="text" className="form-input-custom" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Email *</label>
                  <input type="email" className="form-input-custom" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Phone *</label>
                  <input type="tel" className="form-input-custom" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Password *</label>
                  <input type="password" className="form-input-custom" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Specialization *</label>
                  <input type="text" className="form-input-custom" required value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Qualification</label>
                  <input type="text" className="form-input-custom" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label-custom">Experience (yrs)</label>
                  <input type="number" className="form-input-custom" min={0} value={form.experience_years} onChange={e => setForm({ ...form, experience_years: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label-custom">Fee (₹)</label>
                  <input type="number" className="form-input-custom" min={0} value={form.consultation_fee} onChange={e => setForm({ ...form, consultation_fee: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label-custom">Department</label>
                  <select className="form-input-custom" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="d-flex gap-3 mt-4">
                <button type="button" className="btn-ghost flex-fill" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-custom flex-fill justify-content-center" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
