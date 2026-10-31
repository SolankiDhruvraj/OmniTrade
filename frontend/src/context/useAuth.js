import { useContext } from 'react'
import { AuthContext } from './auth-context.js'

export const useAuth = () => useContext(AuthContext)
