'use client'

import { useState, useRef } from 'react'
import { Upload, Camera, CheckCircle, AlertCircle } from 'lucide-react'

interface ReceiptData {
  merchant: string | null
  amount: number | null
  date: string | null
  currency: string | null
  items: Array<{ name: string; price: number }> | null
}

export default function UploadPage() {
  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvResult, setCsvResult] = useState<{ message?: string; error?: string } | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)

  // Bank sync state
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ message?: string; error?: string } | null>(null)

  async function handleBankSync() {
    setSyncLoading(true)
    setSyncResult(null)
    const res = await fetch('/api/transactions/sync', { method: 'POST' })
    const json = await res.json()
    setSyncResult(json)
    setSyncLoading(false)
  }

  // Receipt state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [receiptMessage, setReceiptMessage] = useState('')
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptSaved, setReceiptSaved] = useState(false)

  // Form fields for receipt confirmation
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')

  const csvInputRef = useRef<HTMLInputElement>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  async function handleCsvUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!csvFile) return
    setCsvLoading(true)
    setCsvResult(null)

    const form = new FormData()
    form.append('file', csvFile)

    const res = await fetch('/api/transactions/import', { method: 'POST', body: form })
    const json = await res.json()
    setCsvResult(json)
    setCsvLoading(false)
    if (!json.error) setCsvFile(null)
  }

  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    setReceiptData(null)
    setReceiptSaved(false)
    setReceiptMessage('')
    const reader = new FileReader()
    reader.onload = ev => setReceiptPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleReceiptUpload() {
    if (!receiptFile) return
    setReceiptLoading(true)
    setReceiptMessage('')

    const form = new FormData()
    form.append('image', receiptFile)

    const res = await fetch('/api/receipts/upload', { method: 'POST', body: form })
    const json = await res.json()

    setReceiptLoading(false)

    if (!json.success || !json.extracted) {
      setReceiptMessage(json.message ?? 'Could not extract receipt details.')
      return
    }

    setReceiptData(json.extracted)
    setMerchant(json.extracted.merchant ?? '')
    setAmount(json.extracted.amount ? String(json.extracted.amount) : '')
    setDate(json.extracted.date ?? new Date().toISOString().split('T')[0])
    setReceiptMessage(json.message)
  }

  async function handleReceiptSave(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/receipts/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant, amount: parseFloat(amount), date }),
    })
    if (res.ok) {
      setReceiptSaved(true)
      setReceiptFile(null)
      setReceiptPreview(null)
      setReceiptData(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: '#4a5568' }}>Import data</h2>
        <p className="text-sm mt-0.5" style={{ color: '#8896a7' }}>Add transactions via CSV or scan a receipt photo</p>
      </div>

      {/* Mock bank sync */}
      <div className="neu-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="neu-flat w-10 h-10 flex items-center justify-center rounded-xl text-lg">🏦</div>
            <div>
              <h3 className="font-semibold" style={{ color: '#4a5568' }}>Mock bank sync</h3>
              <p className="text-xs" style={{ color: '#8896a7' }}>Simulates fetching recent transactions from a connected bank account</p>
            </div>
          </div>
          <button
            onClick={handleBankSync}
            disabled={syncLoading}
            className="neu-btn-accent px-5 py-2 text-sm font-semibold"
          >
            {syncLoading ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {syncResult && (
          <div className="neu-inset px-4 py-3 mt-4 flex items-center gap-2 text-sm">
            {syncResult.error
              ? <><AlertCircle size={15} style={{ color: '#e05252' }} /><span style={{ color: '#e05252' }}>{syncResult.error}</span></>
              : <><CheckCircle size={15} style={{ color: '#48bb78' }} /><span style={{ color: '#48bb78' }}>{syncResult.message}</span></>
            }
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Import */}
        <div className="neu-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="neu-flat w-10 h-10 flex items-center justify-center rounded-xl">
              <Upload size={18} style={{ color: '#6c9bcf' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: '#4a5568' }}>Import CSV</h3>
              <p className="text-xs" style={{ color: '#8896a7' }}>date, amount, merchant columns</p>
            </div>
          </div>

          <form onSubmit={handleCsvUpload} className="space-y-3">
            <div
              className="neu-inset p-6 text-center cursor-pointer transition-all"
              onClick={() => csvInputRef.current?.click()}
            >
              {csvFile ? (
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#4a5568' }}>{csvFile.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8896a7' }}>{(csvFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload size={22} className="mx-auto mb-2" style={{ color: '#a3b1c6' }} />
                  <p className="text-sm" style={{ color: '#8896a7' }}>Click to select CSV file</p>
                </div>
              )}
              <input ref={csvInputRef} type="file" accept=".csv" className="hidden"
                onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setCsvResult(null) }} />
            </div>

            <button type="submit" disabled={!csvFile || csvLoading} className="neu-btn-accent w-full py-2.5 text-sm font-semibold">
              {csvLoading ? 'Importing…' : 'Import transactions'}
            </button>
          </form>

          {csvResult && (
            <div className={`neu-inset flex items-start gap-2 text-sm px-4 py-3`}>
              {csvResult.error
                ? <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: '#e05252' }} />
                : <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: '#48bb78' }} />}
              <span style={{ color: csvResult.error ? '#e05252' : '#48bb78' }}>
                {csvResult.message ?? csvResult.error}
              </span>
            </div>
          )}

          <div className="neu-inset p-4">
            <p className="text-xs font-semibold mb-2" style={{ color: '#6b7a8d' }}>Expected format</p>
            {['date,merchant,amount,category', '2024-01-15,Starbucks,4.75,Food', '2024-01-14,Netflix,15.99,Subscriptions'].map(line => (
              <code key={line} className="block text-xs" style={{ color: '#8896a7', fontFamily: 'monospace' }}>{line}</code>
            ))}
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="neu-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="neu-flat w-10 h-10 flex items-center justify-center rounded-xl">
              <Camera size={18} style={{ color: '#6c9bcf' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: '#4a5568' }}>Scan receipt</h3>
              <p className="text-xs" style={{ color: '#8896a7' }}>AI extracts details automatically</p>
            </div>
          </div>

          {!receiptData && !receiptSaved && (
            <div className="space-y-3">
              <div
                className="neu-inset overflow-hidden cursor-pointer"
                style={{ minHeight: 140 }}
                onClick={() => receiptInputRef.current?.click()}
              >
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Receipt" className="w-full max-h-48 object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Camera size={24} className="mb-2" style={{ color: '#a3b1c6' }} />
                    <p className="text-sm" style={{ color: '#8896a7' }}>Click to select image</p>
                  </div>
                )}
                <input ref={receiptInputRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptSelect} />
              </div>

              {receiptFile && (
                <button onClick={handleReceiptUpload} disabled={receiptLoading}
                  className="neu-btn-accent w-full py-2.5 text-sm font-semibold">
                  {receiptLoading ? 'Reading receipt…' : 'Extract details'}
                </button>
              )}

              {receiptMessage && !receiptData && (
                <div className="neu-inset px-4 py-3">
                  <p className="text-sm" style={{ color: '#c9873a' }}>{receiptMessage}</p>
                </div>
              )}
            </div>
          )}

          {receiptData && !receiptSaved && (
            <form onSubmit={handleReceiptSave} className="space-y-4">
              <div className="neu-inset px-4 py-2.5">
                <p className="text-xs font-medium" style={{ color: '#48bb78' }}>✓ Details extracted — confirm to save</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7a8d' }}>Merchant</label>
                <input value={merchant} onChange={e => setMerchant(e.target.value)} required
                  className="neu-input w-full px-4 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7a8d' }}>Amount ($)</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                    className="neu-input w-full px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7a8d' }}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                    className="neu-input w-full px-4 py-2.5 text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="neu-btn-accent flex-1 py-2.5 text-sm font-semibold">Save</button>
                <button type="button" onClick={() => { setReceiptData(null); setReceiptFile(null); setReceiptPreview(null) }}
                  className="neu-btn px-5 py-2.5 text-sm font-medium" style={{ color: '#8896a7' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {receiptSaved && (
            <div className="text-center py-8">
              <div className="inline-flex w-14 h-14 rounded-2xl neu-flat items-center justify-center text-2xl mb-3">✅</div>
              <p className="font-semibold" style={{ color: '#4a5568' }}>Transaction saved!</p>
              <button onClick={() => setReceiptSaved(false)}
                className="mt-4 neu-btn px-5 py-2 text-sm font-medium" style={{ color: '#6c9bcf' }}>
                Scan another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
