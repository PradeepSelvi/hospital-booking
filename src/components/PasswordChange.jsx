import { useState } from 'react'
import { changePassword } from '../services/profiles'
import { toast } from 'react-toastify'

/**
 * Reusable password change form with strength indicator.
 * Uses Supabase Auth updateUser under the hood.
 *
 * Props:
 * - onSuccess: () => void — callback after successful change
 */
export default function PasswordChange({ onSuccess }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Password strength calculation
  function getStrength(password) {
    if (!password) return { level: 0, label: '', color: '' }

    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 1) return { level: 1, label: 'Weak', color: 'var(--danger)' }
    if (score <= 2) return { level: 2, label: 'Fair', color: '#F97316' }
    if (score <= 3) return { level: 3, label: 'Good', color: 'var(--warning)' }
    if (score <= 4) return { level: 4, label: 'Strong', color: 'var(--success)' }
    return { level: 5, label: 'Excellent', color: '#059669' }
  }

  function validate() {
    const errs = {}
    if (!newPassword) errs.newPassword = 'Password is required'
    else if (newPassword.length < 8) errs.newPassword = 'Minimum 8 characters'
    else if (!/[A-Z]/.test(newPassword)) errs.newPassword = 'Include at least one uppercase letter'
    else if (!/[0-9]/.test(newPassword)) errs.newPassword = 'Include at least one number'

    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password'
    else if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    try {
      setSaving(true)
      await changePassword(newPassword)
      toast.success('Password changed successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setErrors({})
      onSuccess?.()
    } catch (err) {
      toast.error(err.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const strength = getStrength(newPassword)

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label className="form-label-custom">New Password</label>
        <div style={{ position: 'relative' }}>
          <input
            id="password-change-new"
            type={showPassword ? 'text' : 'password'}
            className={`form-input-custom ${errors.newPassword ? 'error' : ''}`}
            placeholder="Min 8 characters, 1 uppercase, 1 number"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, newPassword: null })) }}
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--gray-400)', fontSize: 18, padding: 0
            }}
            tabIndex={-1}
          >
            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
          </button>
        </div>
        {errors.newPassword && (
          <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.newPassword}</span>
        )}

        {/* Strength meter */}
        {newPassword && (
          <div className="mt-2">
            <div className="password-strength-meter">
              <div
                className="password-strength-fill"
                style={{
                  width: `${(strength.level / 5) * 100}%`,
                  background: strength.color
                }}
              />
            </div>
            <span className="password-strength-label" style={{ color: strength.color }}>
              {strength.label}
            </span>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="form-label-custom">Confirm New Password</label>
        <input
          id="password-change-confirm"
          type={showPassword ? 'text' : 'password'}
          className={`form-input-custom ${errors.confirmPassword ? 'error' : ''}`}
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: null })) }}
        />
        {errors.confirmPassword && (
          <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.confirmPassword}</span>
        )}
      </div>

      <button
        id="password-change-submit"
        type="submit"
        className="btn-primary-custom"
        disabled={saving || !newPassword || !confirmPassword}
        style={{ padding: '10px 24px' }}
      >
        {saving ? (
          <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Changing...</>
        ) : (
          <><i className="bi bi-shield-lock" /> Update Password</>
        )}
      </button>
    </form>
  )
}
