import axios from 'axios'

export const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const api = axios.create({ baseURL: apiBase, withCredentials: true })

export async function authRequest(path: string, body: Record<string, string>) {
  try {
    const response = await api.post<{ msg?: string }>(`/api/auth/${path}`, body)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { msg?: string; message?: string } | undefined
      throw new Error(data?.msg || data?.message || (error.response ? 'Something went wrong. Please try again.' : 'Could not reach the server. Please try again.'), { cause: error })
    }
    throw error
  }
}

export default api
