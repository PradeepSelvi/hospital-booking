import { useState, useEffect } from 'react'
import { getDoctorByUserId, updateDoctorProfile } from '../../services/doctors'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function DoctorProfileEdit() {
  const { user, profile } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    specialization: '', qualification: '', experience_years: 0, consultation_fee: 0
  })

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  async function loadProfile() {
    try {
      setLoading(true)
      const doc = await getDoctorByUserId(user.id)
      if (doc) {
        setDoctor(doc)
        setForm({
          specialization: doc.specialization ?? '',
          qualification: doc.qualification ?? '',
          experience_years: doc.experience_years ?? 0,
          consultation_fee: doc.consultation_fee ?? 0
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!doctor) return
    try {
      setSaving(true)
      await updateDoctorProfile(doctor.id, form)
      toast.success('Profile updated successfully!')
    } catch (err) {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading profile..." />

  return (
    <div>
      <div className="mb-4">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
          My Profile
        </h4>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          Update your professional details
        </p>
      </div>

      <div className="row g-4">
        {/* Profile Card */}
        <div className="col-lg-4">
          <div className="card-custom p-4 text-center">
            <div className="avatar avatar-xl mx-auto mb-3">
              {profile?.name?.charAt(0) ?? 'D'}
            </div>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4 }}>
              Dr. {profile?.name ?? 'Doctor'}
            </h5>
            <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>
              {form.specialization || 'Specialist'}
            </p>
            <hr className="divider" />
            <div className="d-flex flex-column gap-2 text-start">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-envelope" style={{ color: 'var(--gray-400)' }} />
                <span style={{ fontSize: 14, color: 'var(--gray-600)' }}>{profile?.email ?? user?.email}</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-telephone" style={{ color: 'var(--gray-400)' }} />
                <span style={{ fontSize: 14, color: 'var(--gray-600)' }}>{profile?.phone ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="col-lg-8">
          <div className="card-custom p-4">
            <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
              <i className="bi bi-pencil-square me-2 text-primary" />Edit Professional Details
            </h6>
            <form onSubmit={handleSave}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label-custom">Specialization</label>
                  <input
                    type="text"
                    className="form-input-custom"
                    value={form.specialization}
                    onChange={e => setForm({ ...form, specialization: e.target.value })}
                    placeholder="e.g. Cardiology"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Qualification</label>
                  <input
                    type="text"
                    className="form-input-custom"
                    value={form.qualification}
                    onChange={e => setForm({ ...form, qualification: e.target.value })}
                    placeholder="e.g. MBBS, MD"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Years of Experience</label>
                  <input
                    type="number"
                    className="form-input-custom"
                    min={0}
                    value={form.experience_years}
                    onChange={e => setForm({ ...form, experience_years: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label-custom">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    className="form-input-custom"
                    min={0}
                    value={form.consultation_fee}
                    onChange={e => setForm({ ...form, consultation_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary-custom mt-4" disabled={saving}>
                {saving ? (
                  <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
                ) : (
                  <><i className="bi bi-check-lg" /> Save Changes</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
