import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-toastify'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm()

  const password = watch('password')

  async function onSubmit(data) {
    try {
      setLoading(true)
      const result = await signUp(data.email, data.password, {
        name: data.name,
        phone: data.phone,
        role: 'PATIENT'
      })

      // The trigger should auto-create the profile, but as a safety net
      // we also try to upsert manually using the user ID from signUp response
      const userId = result?.user?.id
      if (userId) {
        const { error: profileError } = await supabase.from('profiles').upsert([{
          id: userId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: 'PATIENT',
          is_active: true
        }], { onConflict: 'id' })
        if (profileError) console.warn('Profile upsert warning:', profileError.message)
      }

      toast.success('Account created successfully! Please login.')
      navigate('/login')
    } catch (err) {
      toast.error(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-left">
        <div className="auth-brand">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <i className="bi bi-heart-pulse-fill" style={{ fontSize: 32, color: 'var(--primary-light)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'white' }}>
              Medi<span style={{ color: 'var(--primary-light)' }}>Book</span>
            </span>
          </Link>
        </div>
        <div className="auth-hero-content">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
            Join MediBook<br />Today
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 16, lineHeight: 1.7 }}>
            Create your free account and get instant access to thousands of verified doctors and specialists.
          </p>
          <div className="mt-4 d-flex flex-column gap-3">
            {[
              { icon: 'bi-calendar-check', text: 'Book appointments 24/7' },
              { icon: 'bi-bell-fill', text: 'Get appointment reminders' },
              { icon: 'bi-star-fill', text: 'Rate and review doctors' },
            ].map(item => (
              <div key={item.text} className="d-flex align-items-center gap-3">
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(0,180,216,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <i className={`bi ${item.icon}`} style={{ color: 'var(--primary-light)', fontSize: 16 }} />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-page-right">
        <div className="auth-form-container">
          <div className="mb-4">
            <div className="section-badge">Get Started</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', marginTop: 8 }}>
              Create your account
            </h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 15, marginTop: 6 }}>
              Fill in your details to register as a patient
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-3">
              <label className="form-label-custom">Full Name</label>
              <div className="search-input-wrapper">
                <i className="bi bi-person" />
                <input
                  id="register-name"
                  type="text"
                  className={`form-input-custom ${errors.name ? 'error' : ''}`}
                  placeholder="John Doe"
                  style={{ paddingLeft: 42 }}
                  {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
                />
              </div>
              {errors.name && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.name.message}</span>}
            </div>

            <div className="mb-3">
              <label className="form-label-custom">Email Address</label>
              <div className="search-input-wrapper">
                <i className="bi bi-envelope" />
                <input
                  id="register-email"
                  type="email"
                  className={`form-input-custom ${errors.email ? 'error' : ''}`}
                  placeholder="you@example.com"
                  style={{ paddingLeft: 42 }}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                  })}
                />
              </div>
              {errors.email && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.email.message}</span>}
            </div>

            <div className="mb-3">
              <label className="form-label-custom">Phone Number</label>
              <div className="search-input-wrapper">
                <i className="bi bi-telephone" />
                <input
                  id="register-phone"
                  type="tel"
                  className={`form-input-custom ${errors.phone ? 'error' : ''}`}
                  placeholder="+91 98765 43210"
                  style={{ paddingLeft: 42 }}
                  {...register('phone', { required: 'Phone is required', minLength: { value: 10, message: 'Invalid phone number' } })}
                />
              </div>
              {errors.phone && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.phone.message}</span>}
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label-custom">Password</label>
                <input
                  id="register-password"
                  type="password"
                  className={`form-input-custom ${errors.password ? 'error' : ''}`}
                  placeholder="Min 6 characters"
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                />
                {errors.password && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.password.message}</span>}
              </div>
              <div className="col-md-6">
                <label className="form-label-custom">Confirm Password</label>
                <input
                  id="register-confirm-password"
                  type="password"
                  className={`form-input-custom ${errors.confirmPassword ? 'error' : ''}`}
                  placeholder="Re-enter password"
                  {...register('confirmPassword', {
                    required: 'Please confirm password',
                    validate: val => val === password || 'Passwords do not match'
                  })}
                />
                {errors.confirmPassword && <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.confirmPassword.message}</span>}
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              className="btn-primary-custom w-100 justify-content-center mt-3"
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner-custom" style={{ width: 20, height: 20, borderWidth: 2 }} /> Creating Account...</>
              ) : (
                <>Create Account <i className="bi bi-arrow-right" /></>
              )}
            </button>
          </form>

          <p className="text-center mt-4" style={{ fontSize: 14, color: 'var(--gray-500)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 600 }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
