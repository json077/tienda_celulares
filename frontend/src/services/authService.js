import { api } from './api'

const login = async (username, password) => {
  return api.post('/auth/login', {
    username,
    password,
  })
}

const me = async (token, signal) => {
  return api.get('/auth/me', { token, signal })
}

export const authService = {
  login,
  me,
}
