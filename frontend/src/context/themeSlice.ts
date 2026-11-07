import { createSlice } from '@reduxjs/toolkit'

function initialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('jurismate-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* Use the system preference when storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const themeSlice = createSlice({
  name: 'theme',
  initialState: initialTheme(),
  reducers: { toggleTheme: state => state === 'light' ? 'dark' : 'light' },
})

export const { toggleTheme } = themeSlice.actions
export default themeSlice.reducer
