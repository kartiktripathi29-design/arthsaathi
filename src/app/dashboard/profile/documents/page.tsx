'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { unlockNextTab } from '../layout'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }

interface UploadedDoc {
  id: string
  name: string
  type: 'salary' | 'ais' | '26as'
  file: File
  preview?: string
}

export default function DocumentsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (!files) return

    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileName = file.name.toLowerCase()
        
        let docType: 'salary' | 'ais' | '26as' = 'salary'
        if (fileName.includes('ais') || fileName.includes('annual')) docType = 'ais'
        else if (fileName.includes('26as') || fileName.includes('26')) docType = '26as'

        const preview = `${file.name} (${(file.size / 1024).toFixed(0)}KB)`

        const newDoc: UploadedDoc = {
          id: Math.random().toString(36).slice(2, 9),
          name: file.name,
          type: docType,
          file,
          preview,
        }

        setDocs(prev => [...prev, newDoc])
      }
      toast.success(`${files.length} file(s) uploaded`)
    } catch (err) {
      toast.error('Upload failed')
      console.error(err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveDoc = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id))
    toast.success('Document removed')
  }

  const handleProceed = async () => {
    if (docs.length === 0) {
      toast.error('Please upload at least one document')
      return
    }

    try {
      const docsData = docs.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        uploadedAt: new Date().toISOString(),
      }))
      localStorage.setItem('av_uploaded_docs', JSON.stringify(docsData))
      
      unlockNextTab('documents')
      toast.success('Proceeding to Salary tab...')
      router.push('/dashboard/profile/salary')
    } catch (err) {
      toast.error('Failed to save documents')
      console.error(err)
    }
  }

  return (
    <div style={{ maxWidth:800 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 8px' }}>Upload Documents</h2>
        <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px', lineHeight:1.6 }}>
          Upload your salary slip, AIS (Annual Information Statement), or Form 26AS. We'll extract the data automatically.
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border:`2px dashed ${C.border}`,
            borderRadius:8,
            padding:32,
            textAlign:'center',
            cursor:'pointer',
            background:C.wl,
            transition:'all 0.2s',
            marginBottom:20,
          }}
          onMouseOver={e => {
            if (e.currentTarget) (e.currentTarget as HTMLDivElement).style.borderColor = C.fg
          }}
          onMouseOut={e => {
            if (e.currentTarget) (e.currentTarget as HTMLDivElement).style.borderColor = C.border
          }}
        >
          <div style={{ fontSize:32, marginBottom:8 }}>📁</div>
          <p style={{ fontSize:14, fontWeight:600, color:C.text, margin:'0 0 4px' }}>
            Click to upload or drag files
          </p>
          <p style={{ fontSize:12, color:C.muted, margin:0 }}>
            PDF, PNG, JPG, Excel — any format
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
          onChange={handleFileSelect}
          style={{ display:'none' }}
        />

        {docs.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 12px' }}>
              {docs.length} file(s) uploaded
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    padding:12,
                    background:C.wl,
                    borderRadius:6,
                    border:`1px solid ${C.border}`,
                  }}
                >
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:13, fontWeight:500, color:C.text, margin:'0 0 2px' }}>
                      {doc.name}
                    </p>
                    <p style={{ fontSize:11, color:C.muted, margin:0 }}>
                      {doc.type.toUpperCase()} • {doc.preview}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveDoc(doc.id)}
                    style={{
                      padding:'6px 12px',
                      background:C.danger,
                      color:'#fff',
                      border:'none',
                      borderRadius:4,
                      fontSize:11,
                      cursor:'pointer',
                      fontFamily:'inherit',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding:'10px 16px',
              background:C.card,
              color:C.text,
              border:`1px solid ${C.border}`,
              borderRadius:6,
              fontSize:13,
              fontWeight:500,
              cursor:'pointer',
              fontFamily:'inherit',
            }}
          >
            + Add More
          </button>
          <button
            onClick={handleProceed}
            disabled={docs.length === 0 || uploading}
            style={{
              padding:'10px 20px',
              background: docs.length > 0 ? C.fg : C.muted,
              color:C.wheat,
              border:'none',
              borderRadius:6,
              fontSize:13,
              fontWeight:600,
              cursor: docs.length > 0 ? 'pointer' : 'not-allowed',
              fontFamily:'inherit',
              opacity: docs.length > 0 ? 1 : 0.6,
            }}
          >
            Proceed to Salary →
          </button>
        </div>
      </div>
    </div>
  )
}
