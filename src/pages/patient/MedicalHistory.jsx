import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  getMedicalHistory, upsertMedicalHistory,
  getMedicalDocuments, groupByCategory,
  uploadMedicalDocument, deleteMedicalDocument,
} from '../../services/medicalHistory'
import MedicalDocumentUploader from '../../components/MedicalDocumentUploader'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { toast } from 'react-toastify'

const TEXT_FIELDS = [
  { key: 'medical_summary', label: 'Medical Summary', placeholder: 'A short overview of your overall health, recent diagnoses, etc.' },
  { key: 'previous_concerns', label: 'Previous Doctor Concerns', placeholder: 'Concerns or notes raised by doctors you have seen before.' },
  { key: 'current_medications', label: 'Current Medications', placeholder: 'Medicines you take regularly, with dosage if known.' },
  { key: 'allergies', label: 'Allergies', placeholder: 'Drug, food or other allergies.' },
  { key: 'chronic_conditions', label: 'Chronic Conditions', placeholder: 'Diabetes, hypertension, asthma, etc.' },
  { key: 'other_info', label: 'Other Information', placeholder: 'Anything else a doctor should know.' },
]

const EMPTY = {
  medical_summary: '', previous_concerns: '', current_medications: '',
  allergies: '', chronic_conditions: '', other_info: '',
}

export default function MedicalHistory() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState(EMPTY)
  const [grouped, setGrouped] = useState({ SHEET: [], SCAN: [], OTHER: [] })
  const [uploadingKey, setUploadingKey] = useState(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    try {
      setLoading(true)
      const [history, docs] = await Promise.all([
        getMedicalHistory(user.id),
        getMedicalDocuments(user.id),
      ])
      if (history) {
        setFields({ ...EMPTY, ...Object.fromEntries(
          Object.keys(EMPTY).map(k => [k, history[k] ?? ''])
        ) })
      }
      setGrouped(groupByCategory(docs))
    } catch (err) {
      toast.error(err.message || 'Failed to load medical history.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    try {
      setSaving(true)
      await upsertMedicalHistory(user.id, fields)
      toast.success('Medical history saved.')
    } catch (err) {
      toast.error(err.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(category, file) {
    try {
      setUploadingKey(category)
      await uploadMedicalDocument(user.id, category, file)
      const docs = await getMedicalDocuments(user.id)
      setGrouped(groupByCategory(docs))
      toast.success('File uploaded.')
    } catch (err) {
      toast.error(err.message || 'Upload failed.')
    } finally {
      setUploadingKey(null)
    }
  }

  async function handleDelete(docId) {
    try {
      await deleteMedicalDocument(docId)
      const docs = await getMedicalDocuments(user.id)
      setGrouped(groupByCategory(docs))
      toast.success('File deleted.')
    } catch (err) {
      toast.error(err.message || 'Delete failed.')
    }
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: 880, padding: '32px 16px 64px' }}>
        <div className="mb-4">
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>My Medical History</h1>
          <p style={{ color: 'var(--gray-500)', margin: '6px 0 0' }}>
            Keep your records here. You control who sees them — a doctor can view these
            only after you grant access for an appointment.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-custom" />
          </div>
        ) : (
          <>
            {/* ── Text fields ── */}
            <form onSubmit={handleSave} className="card-custom" style={{ padding: 24, marginBottom: 24 }}>
              <h5 style={{ fontWeight: 600, marginBottom: 16 }}>Health Summary</h5>
              {TEXT_FIELDS.map(f => (
                <div key={f.key} className="mb-3">
                  <label className="form-label-custom">{f.label}</label>
                  <textarea
                    className="form-input-custom"
                    rows={3}
                    maxLength={2000}
                    placeholder={f.placeholder}
                    value={fields[f.key]}
                    onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <button type="submit" className="btn-primary-custom" disabled={saving}>
                {saving ? 'Saving...' : 'Save Summary'}
              </button>
            </form>

            {/* ── Documents ── */}
            <div className="card-custom" style={{ padding: 24 }}>
              <h5 style={{ fontWeight: 600, marginBottom: 4 }}>Documents</h5>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
                Upload up to 3 files per section.
              </p>
              <MedicalDocumentUploader
                grouped={grouped}
                uploadingKey={uploadingKey}
                onUpload={handleUpload}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}
      </div>
      <Footer />
    </>
  )
}
