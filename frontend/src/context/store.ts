import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import themeReducer from './themeSlice'

export const store = configureStore({ reducer: { auth: authReducer, theme: themeReducer } })
function applyTheme() {
  const theme = store.getState().theme
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem('jurismate-theme', theme) } catch { /* Storage can be disabled. */ }
}
applyTheme()
store.subscribe(applyTheme)
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
