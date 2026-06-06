import { useState, useEffect } from 'react'
import { getAppointmentReport } from '../../services/admin'
import { getDoctors } from '../../services/doctors'
import { toast } from 'react-toastify'
import LoadingSpinner from '../../components/LoadingSpinner'
import { Doughnut, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function Reports() {
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    // Default: last 30 days
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)
    setFromDate(from.toISOString().split('T')[0])
    setToDate(to.toISOString().split('T')[0])
    loadData(from.toISOString().split('T')[0], to.toISOString().split('T')[0])
  }, [])

  async function loadData(from, to) {
    try {
      setLoading(true)
      const [apts, docs] = await Promise.all([
        getAppointmentReport({ from_date: from, to_date: to }),
        getDoctors()
      ])
      setAppointments(apts)
      setDoctors(docs)
    } catch (err) {
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  function handleFilter() {
    if (fromDate && toDate) loadData(fromDate, toDate)
  }

  function escapeCSV(value) {
    const str = String(value ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  function exportCSV() {
    if (appointments.length === 0) return toast.info('No data to export')
    const headers = ['ID', 'Patient', 'Doctor', 'Specialization', 'Date', 'Time', 'Status', 'Reason']
    const rows = appointments.map(a => [
      a.id,
      a.profiles?.name ?? '',
      a.doctors?.profiles?.name ?? '',
      a.doctors?.specialization ?? '',
      a.appointment_date,
      a.slot_start_time?.substring(0, 5) ?? '',
      a.status,
      a.reason ?? ''
    ].map(escapeCSV))
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `appointment_report_${fromDate}_${toDate}.csv`
    el.click()
    URL.revokeObjectURL(url)
    toast.success('Report downloaded!')
  }

  // Status breakdown for donut chart
  const statusCounts = {
    PENDING: appointments.filter(a => a.status === 'PENDING').length,
    CONFIRMED: appointments.filter(a => a.status === 'CONFIRMED').length,
    COMPLETED: appointments.filter(a => a.status === 'COMPLETED').length,
    CANCELLED: appointments.filter(a => a.status === 'CANCELLED').length,
  }

  const donutData = {
    labels: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    datasets: [{
      data: [statusCounts.PENDING, statusCounts.CONFIRMED, statusCounts.COMPLETED, statusCounts.CANCELLED],
      backgroundColor: ['#F9C74F', '#2DC653', '#0077B6', '#EF233C'],
      borderWidth: 0,
      hoverOffset: 8
    }]
  }

  // Doctor-wise appointment count for bar chart
  const doctorCounts = {}
  appointments.forEach(a => {
    const name = a.doctors?.profiles?.name ?? 'Unknown'
    doctorCounts[name] = (doctorCounts[name] ?? 0) + 1
  })
  const sortedDoctors = Object.entries(doctorCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const barData = {
    labels: sortedDoctors.map(([name]) => `Dr. ${name}`),
    datasets: [{
      label: 'Appointments',
      data: sortedDoctors.map(([, count]) => count),
      backgroundColor: 'rgba(0,119,182,0.7)',
      borderRadius: 6,
      barThickness: 32
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#03045E', cornerRadius: 8, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter', size: 12 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { ticks: { font: { family: 'Inter', size: 11 } }, grid: { display: false } }
    }
  }

  if (loading) return <LoadingSpinner text="Generating report..." />

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>
            Reports & Analytics
          </h4>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
            Appointment analytics and downloadable reports
          </p>
        </div>
        <button className="btn-primary-custom" onClick={exportCSV}>
          <i className="bi bi-download" /> Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="card-custom p-3 mb-4">
        <div className="d-flex gap-3 align-items-center flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>From</label>
            <input type="date" className="form-input-custom" style={{ width: 160, padding: '8px 12px', fontSize: 14 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>To</label>
            <input type="date" className="form-input-custom" style={{ width: 160, padding: '8px 12px', fontSize: 14 }} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={handleFilter}>
            <i className="bi bi-funnel me-1" />Apply
          </button>
          <span style={{ fontSize: 13, color: 'var(--gray-400)', marginLeft: 'auto' }}>
            {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} in range
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4 stagger-children">
        {[
          { label: 'Total', value: appointments.length, color: 'var(--primary)', bg: 'rgba(0,119,182,0.1)' },
          { label: 'Completed', value: statusCounts.COMPLETED, color: 'var(--success)', bg: 'rgba(45,198,83,0.1)' },
          { label: 'Cancelled', value: statusCounts.CANCELLED, color: 'var(--danger)', bg: 'rgba(239,35,60,0.1)' },
          { label: 'Completion Rate', value: appointments.length > 0 ? Math.round((statusCounts.COMPLETED / appointments.length) * 100) + '%' : '0%', color: 'var(--info)', bg: 'rgba(76,201,240,0.1)' },
        ].map((stat, i) => (
          <div key={i} className="col-6 col-xl-3">
            <div className="card-custom p-4">
              <div style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500 }}>{stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: stat.color, marginTop: 4 }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="row g-4 mb-4">
        <div className="col-lg-5">
          <div className="card-custom p-4 h-100">
            <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
              <i className="bi bi-pie-chart me-2 text-primary" />Status Breakdown
            </h6>
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {appointments.length > 0 ? (
                <Doughnut
                  data={donutData}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { family: 'Inter', size: 12 } } }
                    },
                    cutout: '65%'
                  }}
                />
              ) : (
                <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>No data available</p>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card-custom p-4 h-100">
            <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>
              <i className="bi bi-bar-chart me-2 text-primary" />Top Doctors by Appointments
            </h6>
            <div style={{ height: 260 }}>
              {sortedDoctors.length > 0 ? (
                <Bar data={barData} options={chartOptions} />
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100">
                  <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>No data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Doctor-wise Table */}
      {sortedDoctors.length > 0 && (
        <div className="card-custom p-4">
          <h6 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16 }}>
            <i className="bi bi-table me-2 text-primary" />Doctor-wise Summary
          </h6>
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Total</th>
                  <th>Completed</th>
                  <th>Cancelled</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {sortedDoctors.map(([name, total]) => {
                  const docApts = appointments.filter(a => (a.doctors?.profiles?.name ?? 'Unknown') === name)
                  return (
                    <tr key={name}>
                      <td style={{ fontWeight: 600 }}>Dr. {name}</td>
                      <td>{total}</td>
                      <td style={{ color: 'var(--success)' }}>{docApts.filter(a => a.status === 'COMPLETED').length}</td>
                      <td style={{ color: 'var(--danger)' }}>{docApts.filter(a => a.status === 'CANCELLED').length}</td>
                      <td style={{ color: 'var(--warning)' }}>{docApts.filter(a => a.status === 'PENDING').length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
