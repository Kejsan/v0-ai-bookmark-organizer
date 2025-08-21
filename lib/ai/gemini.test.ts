import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'

// Simple in-memory store to simulate Supabase table
const store: { record: any } = { record: null }

vi.mock('@/lib/supabase/server', () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: store.record, error: null }),
            }),
          }),
        }),
      }),
    }),
  }
})

import { getUserGeminiKey } from './gemini'

function encryptSecret(plaintext: string): { ciphertext: Buffer; nonce: Buffer } {
  const masterKey = process.env.APP_KMS_MASTER_KEY!
  const key = Buffer.from(masterKey, 'base64')
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)

  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const authTag = cipher.getAuthTag()
  const ciphertext = Buffer.concat([encrypted, authTag])

  return { ciphertext, nonce }
}

describe('Gemini key storage', () => {
  it('encrypts, stores, retrieves, and decrypts the key', async () => {
    const apiKey = 'AIzaSyDUMMYKEY'
    process.env.APP_KMS_MASTER_KEY = crypto.randomBytes(32).toString('base64')

    // Encrypt and store the key as the route handler would
    const { ciphertext, nonce } = encryptSecret(apiKey)
    store.record = {
      encrypted_key: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
    }

    // Retrieve and decrypt via getUserGeminiKey
    const result = await getUserGeminiKey('user-123')
    expect(result).toBe(apiKey)
  })
})
