import { config } from './config'

// PKCE Auth helper — no library needed for this flow
function generateCodeVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function initiateLogin() {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem('pkce_verifier', verifier)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.cognito.clientId,
    redirect_uri: config.cognito.redirectUri,
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `https://${config.cognito.domain}/oauth2/authorize?${params}`
}

export async function handleCallback(code) {
  const verifier = sessionStorage.getItem('pkce_verifier')
  if (!verifier) throw new Error('No PKCE verifier found')

  const resp = await fetch(`https://${config.cognito.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.cognito.clientId,
      code,
      redirect_uri: config.cognito.redirectUri,
      code_verifier: verifier,
    }),
  })

  if (!resp.ok) throw new Error('Token exchange failed')
  const tokens = await resp.json()
  sessionStorage.setItem('id_token', tokens.id_token)
  sessionStorage.setItem('access_token', tokens.access_token)
  sessionStorage.removeItem('pkce_verifier')
  return tokens
}

export function getIdToken() { return sessionStorage.getItem('id_token') }
export function getAccessToken() { return sessionStorage.getItem('access_token') }

export function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function getCurrentUser() {
  const token = getIdToken()
  if (!token) return null
  const claims = parseJwt(token)
  if (!claims) return null
  const groups = (claims['cognito:groups'] || [])
  return {
    email: claims.email,
    sub: claims.sub,
    groups,
    isAdmin: groups.includes('prahari-admins'),
  }
}

export function logout() {
  sessionStorage.clear()
  const params = new URLSearchParams({
    client_id: config.cognito.clientId,
    logout_uri: config.cognito.logoutUri,
  })
  window.location.href = `https://${config.cognito.domain}/logout?${params}`
}

export async function apiGet(path) {
  const token = getIdToken()
  const resp = await fetch(`${config.apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!resp.ok) throw new Error(`API error ${resp.status}`)
  return resp.json()
}

export async function apiPost(path, body) {
  const token = getIdToken()
  const resp = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!resp.ok) throw new Error(`API error ${resp.status}`)
  return resp.json()
}
