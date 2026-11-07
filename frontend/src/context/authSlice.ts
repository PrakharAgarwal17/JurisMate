import { createSlice } from '@reduxjs/toolkit'

type AuthState = { status: 'unknown' | 'authenticated' }
const initialState: AuthState = { status: 'unknown' }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticated(state) { state.status = 'authenticated' },
    clearAuthentication(state) { state.status = 'unknown' },
  },
})

export const { setAuthenticated, clearAuthentication } = authSlice.actions
export default authSlice.reducer
