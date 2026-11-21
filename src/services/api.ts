import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const ACCESS_TOKEN_KEY = 'goeats_access_token'
const REFRESH_TOKEN_KEY = 'goeats_refresh_token'

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken?: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((pending) => {
    if (error) {
      pending.reject(error)
    } else if (token) {
      pending.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const refreshToken = tokenStorage.getRefreshToken()
    if (!refreshToken) {
      tokenStorage.clear()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
            }
            resolve(api(originalRequest))
          },
          reject,
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post<{ access_token: string; refresh_token?: string }>(
        `${api.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken },
      )
      tokenStorage.setTokens(data.access_token, data.refresh_token)
      processQueue(null, data.access_token)
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
      }
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      tokenStorage.clear()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
