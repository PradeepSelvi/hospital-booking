import { paiseToRupees } from '../services/payments'

/**
 * Simple printable payment receipt.
 *
 * Props:
 * - payment: payments row (amount_paise, method, status, receipt_number, paid_at)
 * - doctorName, patientName
 * - appointment: { appointment_date, slot_start_time }
 * - onClose
 */
export default function ReceiptModal({ payment, doctorName, patientName, appointment, onClose }) {
  if (!payment) return null

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: 'var(--radius-lg)', padding: 0,
        zIndex: 1001, width: '94%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
      }}>
        <div id="receipt-printable" style={{ padding: 28 }}>
          <div className="text-center mb-3">
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary)' }}>MediBook</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Payment Receipt</div>
          </div>

          <div style={{ borderTop: '1px dashed var(--gray-300)', borderBottom: '1px dashed var(--gray-300)', padding: '12px 0', margin: '12px 0' }}>
            <Row label="Receipt No." value={payment.receipt_number || '—'} />
            <Row label="Patient" value={patientName || '—'} />
            <Row label="Doctor" value={doctorName ? `Dr. ${doctorName}` : '—'} />
            {appointment?.appointment_date && (
              <Row label="Visit" value={`${appointment.appointment_date} ${appointment.slot_start_time?.substring(0, 5) ?? ''}`} />
            )}
            <Row label="Method" value={payment.method === 'OFFLINE' ? 'Cash / Offline' : 'Online (Razorpay)'} />
            {payment.razorpay_payment_id && <Row label="Txn ID" value={payment.razorpay_payment_id} />}
            <Row label="Paid on" value={payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '—'} />
          </div>

          <div className="d-flex justify-content-between align-items-center" style={{ fontWeight: 700, fontSize: 18 }}>
            <span>Total Paid</span>
            <span style={{ color: 'var(--primary)' }}>₹{paiseToRupees(payment.amount_paise)}</span>
          </div>

          <div className="text-center mt-3" style={{ fontSize: 11, color: 'var(--gray-400)' }}>
            <span className={`badge-confirmed`} style={{ padding: '2px 8px', borderRadius: 999 }}>PAID</span>
            <div className="mt-2">Thank you for using MediBook.</div>
          </div>
        </div>

        <div className="d-flex gap-2 px-4 pb-4 receipt-actions">
          <button className="btn-ghost flex-fill" onClick={onClose}>Close</button>
          <button className="btn-primary-custom flex-fill" onClick={() => window.print()}>
            <i className="bi bi-printer me-1" />Print
          </button>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }) {
  return (
    <div className="d-flex justify-content-between" style={{ fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
