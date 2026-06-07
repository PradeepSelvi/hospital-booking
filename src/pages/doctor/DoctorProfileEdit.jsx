import { useState, useEffect } from 'react'
import { getDoctorByUserId, updateDoctorProfile } from '../../services/doctors'
import { getDepartments } from '../../services/admin'
import { getProfile, updateProfile, uploadAvatar, deleteAvatar } from '../../services/profiles'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import AvatarUpload from '../../components/AvatarUpload'
import PasswordChange from '../../components/PasswordChange'
import ProfileTabs from '../../components/ProfileTabs'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function DoctorProfileEdit() {
  const { user, profile: authProfile, refreshProfile } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  // Personal info
  const [personalForm, setPersonalForm] = useState({
    name: '', phone: '', bio: '', avatar_url: null
  })

  // Professional info
  const [profForm, setProfForm] = useState({
    specialization: '', qualification: '', experience_years: 0,
    consultation_fee: 0, department_id: '', registration_number: '',
    languages: []
  })

  // Languages input
  const [langInput, setLangInput] = useState('')

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  async function loadProfile() {
    try {
      setLoading(true)
      const [doc, profile, depts] = await Promise.all([
        getDoctorByUserId(user.id),
        getProfile(user.id),
        getDepartments()
      ])

      setDoctor(doc)
      setDepartments(depts)

      setPersonalForm({
        name: profile.name || '',
        phone: profile.phone || '',
        bio: profile.bio || doc?.bio || '',
        avatar_url: profile.avatar_url || null
      })

      if (doc) {
        setProfForm({
          specialization: doc.specialization || '',
          qualification: doc.qualification || '',
          experience_years: doc.experience_years ?? 0,
          consultation_fee: doc.consultation_fee ?? 0,
          department_id: doc.department_id || '',
          registration_number: doc.registration_number || '',
          languages: doc.languages || []
        })
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePersonal(e) {
    e.preventDefault()
    if (!personalForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      setSaving(true)
      await updateProfile(user.id, {
        name: personalForm.name.trim(),
        phone: personalForm.phone.trim(),
        bio: personalForm.bio.trim()
      })
      await refreshProfile()
      toast.success('Personal information saved!')
    } catch (err) {
      toast.error('Failed to save personal info')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveProfessional(e) {
    e.preventDefault()
    if (!doctor) return
    try {
      setSaving(true)
      await updateDoctorProfile(doctor.id, {
        specialization: profForm.specialization,
        qualification: profForm.qualification,
        experience_years: profForm.experience_years,
        consultation_fee: profForm.consultation_fee,
        department_id: profForm.department_id || null,
        registration_number: profForm.registration_number || null,
        languages: profForm.languages.length > 0 ? profForm.languages : null
      })
      toast.success('Professional details saved!')
    } catch (err) {
      toast.error('Failed to save professional details')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(file) {
    try {
      setUploading(true)
      const url = await uploadAvatar(user.id, file)
      setPersonalForm(prev => ({ ...prev, avatar_url: url }))
      await refreshProfile()
      toast.success('Photo updated!')
    } catch (err) {
      toast.error('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  async function handleAvatarRemove() {
    try {
      setUploading(true)
      await deleteAvatar(user.id)
      setPersonalForm(prev => ({ ...prev, avatar_url: null }))
      await refreshProfile()
      toast.success('Photo removed')
    } catch (err) {
      toast.error('Failed to remove photo')
    } finally {
      setUploading(false)
    }
  }

  function addLanguage() {
    const lang = langInput.trim()
    if (lang && !profForm.languages.includes(lang)) {
      setProfForm(prev => ({ ...prev, languages: [...prev.languages, lang] }))
      setLangInput('')
    }
  }

  function removeLanguage(lang) {
    setProfForm(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== lang)
    }))
  }

  if (loading) return <LoadingSpinner text="Loading profile..." />

  return (
    <div>
      <div className="mb-4">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
          My Profile
        </h4>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
          Manage your personal and professional details
        </p>
      </div>

      <div className="row g-4">
        {/* Profile Card */}
        <div className="col-lg-4">
          <div className="card-custom p-4 text-center" style={{ position: 'sticky', top: 88 }}>
            <div className="d-flex justify-content-center mb-3">
              <AvatarUpload
                currentUrl={personalForm.avatar_url}
                name={personalForm.name}
                size={110}
                onUpload={handleAvatarUpload}
                onRemove={handleAvatarRemove}
                uploading={uploading}
              />
            </div>
            <h5 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4 }}>
              Dr. {personalForm.name || 'Doctor'}
            </h5>
            <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14, margin: '4px 0' }}>
              {profForm.specialization || 'Specialist'}
            </p>
            {profForm.qualification && (
              <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '2px 0' }}>
                {profForm.qualification}
              </p>
            )}

            <hr className="divider" />

            <div className="d-flex flex-column gap-2 text-start">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-envelope" style={{ color: 'var(--gray-400)', width: 20 }} />
                <span style={{ fontSize: 14, color: 'var(--gray-600)' }}>{authProfile?.email ?? user?.email}</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-telephone" style={{ color: 'var(--gray-400)', width: 20 }} />
                <span style={{ fontSize: 14, color: 'var(--gray-600)' }}>{personalForm.phone || '—'}</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-briefcase" style={{ color: 'var(--gray-400)', width: 20 }} />
                <span style={{ fontSize: 14, color: 'var(--gray-600)' }}>{profForm.experience_years} years exp.</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-currency-rupee" style={{ color: 'var(--gray-400)', width: 20 }} />
                <span style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>₹{profForm.consultation_fee}</span>
              </div>
              {profForm.registration_number && (
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-card-text" style={{ color: 'var(--gray-400)', width: 20 }} />
                  <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Reg: {profForm.registration_number}</span>
                </div>
              )}
            </div>

            {/* Languages */}
            {profForm.languages.length > 0 && (
              <>
                <hr className="divider" />
                <div className="text-start">
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Languages
                  </span>
                  <div className="d-flex flex-wrap gap-1 mt-2">
                    {profForm.languages.map(lang => (
                      <span key={lang} style={{
                        background: 'rgba(0,119,182,0.08)', color: 'var(--primary)',
                        padding: '2px 10px', borderRadius: 'var(--radius-full)',
                        fontSize: 12, fontWeight: 500
                      }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edit Area */}
        <div className="col-lg-8">
          <ProfileTabs
            tabs={['Personal', 'Professional', 'Security']}
            activeTab={activeTab}
            onChange={setActiveTab}
            icons={['bi-person', 'bi-briefcase-fill', 'bi-shield-lock']}
          />

          {/* Tab 1: Personal */}
          {activeTab === 0 && (
            <div className="card-custom p-4 mt-3 animate-fadeInUp">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
                <i className="bi bi-person-lines-fill me-2 text-primary" />
                Personal Information
              </h6>
              <form onSubmit={handleSavePersonal}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label-custom">Full Name *</label>
                    <input
                      id="doc-personal-name"
                      type="text"
                      className="form-input-custom"
                      value={personalForm.name}
                      onChange={e => setPersonalForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom">Phone</label>
                    <input
                      id="doc-personal-phone"
                      type="tel"
                      className="form-input-custom"
                      placeholder="+91 98765 43210"
                      value={personalForm.phone}
                      onChange={e => setPersonalForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label-custom">Bio / About</label>
                    <textarea
                      id="doc-personal-bio"
                      className="form-input-custom"
                      rows={4}
                      placeholder="Tell patients about yourself, your approach to care, and your experience..."
                      value={personalForm.bio}
                      onChange={e => setPersonalForm(prev => ({ ...prev, bio: e.target.value }))}
                    />
                    <span style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4, display: 'block' }}>
                      This will be visible on your public profile
                    </span>
                  </div>
                </div>
                <div className="d-flex justify-content-end mt-4">
                  <button type="submit" className="btn-primary-custom" disabled={saving}>
                    {saving ? (
                      <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
                    ) : (
                      <><i className="bi bi-check-lg" /> Save Personal Info</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Professional */}
          {activeTab === 1 && (
            <div className="card-custom p-4 mt-3 animate-fadeInUp">
              <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
                <i className="bi bi-award me-2 text-primary" />
                Professional Details
              </h6>
              <form onSubmit={handleSaveProfessional}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label-custom">Specialization *</label>
                    <input
                      id="doc-prof-spec"
                      type="text"
                      className="form-input-custom"
                      value={profForm.specialization}
                      onChange={e => setProfForm(prev => ({ ...prev, specialization: e.target.value }))}
                      placeholder="e.g. Cardiology"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom">Qualification</label>
                    <input
                      id="doc-prof-qual"
                      type="text"
                      className="form-input-custom"
                      value={profForm.qualification}
                      onChange={e => setProfForm(prev => ({ ...prev, qualification: e.target.value }))}
                      placeholder="e.g. MBBS, MD, DM"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-custom">Experience (years)</label>
                    <input
                      id="doc-prof-exp"
                      type="number"
                      className="form-input-custom"
                      min={0}
                      value={profForm.experience_years}
                      onChange={e => setProfForm(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-custom">Consultation Fee (₹)</label>
                    <input
                      id="doc-prof-fee"
                      type="number"
                      className="form-input-custom"
                      min={0}
                      value={profForm.consultation_fee}
                      onChange={e => setProfForm(prev => ({ ...prev, consultation_fee: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-custom">Department</label>
                    <select
                      id="doc-prof-dept"
                      className="form-input-custom"
                      value={profForm.department_id}
                      onChange={e => setProfForm(prev => ({ ...prev, department_id: e.target.value }))}
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom">Medical Registration No.</label>
                    <input
                      id="doc-prof-reg"
                      type="text"
                      className="form-input-custom"
                      placeholder="e.g. MCI-12345"
                      value={profForm.registration_number}
                      onChange={e => setProfForm(prev => ({ ...prev, registration_number: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label-custom">Languages Spoken</label>
                    <div className="d-flex gap-2">
                      <input
                        id="doc-prof-lang"
                        type="text"
                        className="form-input-custom"
                        placeholder="e.g. Hindi"
                        value={langInput}
                        onChange={e => setLangInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLanguage() } }}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn-ghost" onClick={addLanguage} style={{ whiteSpace: 'nowrap' }}>
                        <i className="bi bi-plus-lg" /> Add
                      </button>
                    </div>
                    {profForm.languages.length > 0 && (
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {profForm.languages.map(lang => (
                          <span key={lang} style={{
                            background: 'rgba(0,119,182,0.08)', color: 'var(--primary)',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            fontSize: 13, fontWeight: 500, display: 'inline-flex',
                            alignItems: 'center', gap: 4
                          }}>
                            {lang}
                            <button
                              type="button"
                              onClick={() => removeLanguage(lang)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--gray-400)', padding: 0, fontSize: 14, lineHeight: 1
                              }}
                            >
                              <i className="bi bi-x" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="d-flex justify-content-end mt-4">
                  <button type="submit" className="btn-primary-custom" disabled={saving}>
                    {saving ? (
                      <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Saving...</>
                    ) : (
                      <><i className="bi bi-check-lg" /> Save Professional Details</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Security */}
          {activeTab === 2 && (
            <div className="animate-fadeInUp">
              <div className="card-custom p-4 mt-3">
                <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
                  <i className="bi bi-key me-2 text-primary" />
                  Change Password
                </h6>
                <PasswordChange />
              </div>

              <div className="card-custom p-4 mt-3">
                <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16 }}>
                  <i className="bi bi-info-circle me-2 text-primary" />
                  Account Information
                </h6>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Email</span>
                    <span style={{ fontWeight: 600 }}>{user?.email}</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Role</span>
                    <span className="badge-confirmed" style={{ fontSize: 11 }}>Doctor</span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Status</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                      <i className="bi bi-check-circle-fill me-1" />Active
                    </span>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Joined</span>
                    <span style={{ fontWeight: 600 }}>
                      {authProfile?.created_at
                        ? new Date(authProfile.created_at).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric'
                          })
                        : '—'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
