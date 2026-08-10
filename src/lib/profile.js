// ---------------------------------------------------------------------------
// Travel profiles — the details you always need at check-in or when booking
// (passport number, date of birth, nationality, frequent-flyer numbers…).
//
// These are sensitive, so the whole profile is AES-encrypted with your vault key
// and stored as ciphertext in `person.profileEnc`. That means it rides the
// existing people sync (which is otherwise clear-text) without ever exposing the
// contents to the server — same zero-knowledge guarantee as your documents.
// ---------------------------------------------------------------------------
import { encryptString, decryptString } from './crypto.js'
import { updatePerson } from './db.js'

export const PROFILE_FIELDS = [
  ['passportNumber', 'Passport number', 'e.g. 123456789'],
  ['passportCountry', 'Passport country', 'e.g. United Kingdom'],
  ['nationality', 'Nationality', 'e.g. British'],
  ['dob', 'Date of birth', 'YYYY-MM-DD'],
  ['placeOfBirth', 'Place of birth', 'e.g. London'],
  ['knownTraveller', 'Global Entry / TSA / known traveller', 'e.g. 123456'],
  ['frequentFlyer', 'Frequent flyer numbers', 'e.g. BA 12345678'],
  ['seatPref', 'Seat / meal preference', 'e.g. Aisle, vegetarian'],
  ['notes', 'Other notes', 'Anything else worth having to hand']
]

export const emptyProfile = () =>
  Object.fromEntries(PROFILE_FIELDS.map(([k]) => [k, '']))

// Decrypt a person's profile. Returns an empty profile when there's none (or if
// it can't be read), so the UI always has something to render.
export async function loadProfile(key, person) {
  if (!key || !person?.profileEnc) return emptyProfile()
  try {
    return { ...emptyProfile(), ...JSON.parse(await decryptString(key, person.profileEnc)) }
  } catch {
    return emptyProfile()
  }
}

// Encrypt + save a person's profile (marks the person dirty so it syncs).
export async function saveProfile(key, personId, profile) {
  const clean = Object.fromEntries(
    Object.entries(profile).map(([k, v]) => [k, (v || '').trim()])
  )
  const hasAny = Object.values(clean).some(Boolean)
  await updatePerson(personId, {
    profileEnc: hasAny ? await encryptString(key, JSON.stringify(clean)) : null
  })
  return clean
}

// True if a person has any profile saved (without needing to decrypt it).
export const hasProfile = person => !!person?.profileEnc
