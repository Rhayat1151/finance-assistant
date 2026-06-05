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
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Import data</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Import */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Upload size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Import transactions (CSV)</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Upload a CSV with columns: date, amount, merchant (and optionally category, description).
          </p>

          <form onSubmit={handleCsvUpload} className="space-y-3">
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => csvInputRef.current?.click()}
            >
              {csvFile ? (
                <div>
                  <p className="text-sm font-medium text-gray-900">{csvFile.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{(csvFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to select CSV file</p>
                </div>
              )}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setCsvResult(null) }}
              />
            </div>

            <button
              type="submit"
              disabled={!csvFile || csvLoading}
              className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {csvLoading ? 'Importing…' : 'Import'}
            </button>
          </form>

          {csvResult && (
            <div className={`mt-3 flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${csvResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {csvResult.error ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
              <span>{csvResult.message ?? csvResult.error}</span>
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600 mb-1">Expected CSV format:</p>
            <code className="text-xs text-gray-500 block">date,merchant,amount,category</code>
            <code className="text-xs text-gray-500 block">2024-01-15,Starbucks,4.75,Food</code>
            <code className="text-xs text-gray-500 block">2024-01-14,Netflix,15.99,Subscriptions</code>
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Camera size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Read a receipt</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Upload a photo and AI will extract the details.
          </p>

          {!receiptData && !receiptSaved && (
            <div className="space-y-3">
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => receiptInputRef.current?.click()}
              >
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Receipt" className="w-full max-h-48 object-contain p-2" />
                ) : (
                  <div className="p-6 text-center">
                    <Camera size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to select image</p>
                  </div>
                )}
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleReceiptSelect}
                />
              </div>

              {receiptFile && (
                <button
                  onClick={handleReceiptUpload}
                  disabled={receiptLoading}
                  className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {receiptLoading ? 'Reading receipt…' : 'Extract details'}
                </button>
              )}

              {receiptMessage && !receiptData && (
                <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">{receiptMessage}</p>
              )}
            </div>
          )}

          {receiptData && !receiptSaved && (
            <form onSubmit={handleReceiptSave} className="space-y-3">
              <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                Details extracted — review and confirm to save.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Merchant</label>
                <input value={merchant} onChange={e => setMerchant(e.target.value)} required
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Save transaction
                </button>
                <button type="button" onClick={() => { setReceiptData(null); setReceiptFile(null); setReceiptPreview(null) }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {receiptSaved && (
            <div className="text-center py-6">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Transaction saved!</p>
              <button onClick={() => setReceiptSaved(false)}
                className="mt-3 text-sm text-blue-600 hover:underline">
                Read another receipt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
