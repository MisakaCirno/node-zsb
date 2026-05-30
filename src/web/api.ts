import type {
  Board,
  EditorData,
} from './types.js'

declare function fetch(url: string, init?: FetchInit): Promise<FetchResponse>

interface FetchInit {
  body?: string
  headers?: Record<string, string>
  method?: string
}

interface FetchResponse {
  ok: boolean
  text(): Promise<string>
}

interface DecodeBoardPayload {
  data: Partial<Board>
}

interface EncodeBoardPayload {
  code: string
}

interface RenderPreviewPayload {
  data: unknown
}

interface ApiErrorPayload {
  ok?: boolean
  error?: string
}

export async function getEditorData(): Promise<EditorData> {
  return getJson<EditorData>('/editor-data')
}

export async function decodeBoardCode(code: string): Promise<Partial<Board>> {
  const payload = await postJson<DecodeBoardPayload>('/utils/code2json', { code })
  return payload.data
}

export async function encodeBoardCode(board: Board, key = 14): Promise<string> {
  const payload = await postJson<EncodeBoardPayload>('/utils/json2code', { board, key })
  return payload.code
}

export async function renderPreviewImage(code: string): Promise<unknown> {
  const payload = await postJson<RenderPreviewPayload>('/board/render', { code })
  return payload.data
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const payload = await readResponsePayload(response)
  if (!response.ok) throw new Error(getErrorMessage(payload))
  return payload as T
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await readResponsePayload(response) as T & ApiErrorPayload
  if (!response.ok || isApiErrorPayload(payload)) {
    throw new Error(getErrorMessage(payload))
  }
  return payload
}

async function readResponsePayload(response: FetchResponse): Promise<unknown> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorPayload {
  return Boolean(payload && typeof payload === 'object' && (payload as ApiErrorPayload).ok === false)
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (payload && typeof payload === 'object') {
    const error = (payload as ApiErrorPayload).error
    if (typeof error === 'string' && error.trim()) return error
  }
  return 'Request failed'
}
