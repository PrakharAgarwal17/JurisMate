import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import api from '../services/api'

type Item = { _id: string; storageKey: string; kind: 'file' | 'note'; title: string; content?: string; mimeType?: string }

export default function RoomStorage({ roomId }: { roomId: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [fileKey, setFileKey] = useState(0)
  const [analysis, setAnalysis] = useState<{ key: string; text: string } | null>(null)

  useEffect(() => {
    let active = true
    api.get<{ items: Item[] }>(`/api/storage/chats/${roomId}/items`)
      .then(response => { if (active) setItems(response.data.items) })
      .catch(() => { if (active) setError('Could not load storage. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [roomId])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setBusy(true); setError('')
    try {
      const data = new FormData(); data.append('file', file)
      const response = await api.post<{ item: Item }>(`/api/storage/chats/${roomId}/files`, data)
      setItems(previous => [response.data.item, ...previous]); setFile(null); setFileKey(value => value + 1)
    } catch (err) { setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'Upload failed. Please try again.') }
    finally { setBusy(false) }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await api.post<{ item: Item & { contextText?: string } }>(`/api/storage/chats/${roomId}/important`, { title, content })
      setItems(previous => [{ ...response.data.item, content }, ...previous]); setTitle(''); setContent('')
    } catch { setError('Could not save your note. Please try again.') }
    finally { setBusy(false) }
  }

  async function download(item: Item) {
    setError('')
    try {
      const response = await api.get<{ url: string }>(`/api/storage/items/${item._id}/download`)
      window.open(response.data.url, '_blank', 'noopener,noreferrer')
    } catch { setError('Could not open this file. Please try again.') }
  }

  async function extract(item: Item) {
    setBusy(true); setError('')
    try {
      const response = await api.post<{ storageKey: string; context: string; truncated?: boolean }>(`/api/storage/items/${item._id}/context`)
      setAnalysis({ key: response.data.storageKey, text: response.data.context + (response.data.truncated ? '\n\n[Content was truncated.]' : '') })
    } catch { setError('Could not extract file context. Please try again.') }
    finally { setBusy(false) }
  }

  return <section className="switch-room room-storage"><h2>Room storage</h2><p>Keep this matter’s PDFs, images and important notes together. Each item has a unique reference key.</p>
    {error && <p className="home-error" role="alert">{error}</p>}
    <form onSubmit={upload}><label htmlFor="room-file">Upload a PDF or image</label><input key={fileKey} id="room-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} required /><button className="home-add" disabled={busy || !file}>{busy ? 'Please wait…' : 'Upload file'}</button></form>
    <form onSubmit={saveNote}><label htmlFor="note-title">Save important information</label><input id="note-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={200} placeholder="Note title" required /><textarea aria-label="Note contents" value={content} onChange={event => setContent(event.target.value)} maxLength={100000} placeholder="Write your note…" required /><button className="home-add" disabled={busy}>Save note</button></form>
    <h3>Saved items</h3>{loading ? <p>Loading storage…</p> : items.length === 0 ? <p>No files or notes saved yet.</p> : <div className="stored-list">{items.map(item => <article key={item._id}><strong>{item.title}</strong><span>{item.kind === 'file' ? 'File' : 'Note'} · {item.storageKey}</span>{item.kind === 'note' && <p>{item.content}</p>}{item.kind === 'file' && <><button className="room-open" onClick={() => void download(item)}>Open file ↗</button>{' · '}<button className="room-open" disabled={busy} onClick={() => void extract(item)}>Extract context</button></>}{analysis?.key === item.storageKey && <p>{analysis.text}</p>}</article>)}</div>}
  </section>
}
