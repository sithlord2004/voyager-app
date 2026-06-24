// ---------------------------------------------------------------------------
// Passport OCR auto-fill. Reads the Machine-Readable Zone (MRZ) at the bottom of
// a passport photo page and extracts number, nationality, DOB, sex, expiry, and
// name. The MRZ parsing/validation is deterministic (with check digits) and is
// covered by unit tests; the OCR step uses tesseract.js, lazily imported.
//
// Privacy: OCR runs entirely in the browser. The extracted fields only pre-fill
// the form — nothing is sent anywhere, and the image is still encrypted on save.
// ---------------------------------------------------------------------------

// TD3 (passport) check-digit: weights 7,3,1; '<'=0, 0-9=value, A-Z=10..35.
function charVal(c) {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55
  return 0 // '<'
}
export function checkDigit(str) {
  const w = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < str.length; i++) sum += charVal(str[i]) * w[i % 3]
  return sum % 10
}

// YYMMDD -> ISO. `expiry` true biases century to 20YY; DOB uses a past heuristic.
function mrzDateToISO(yymmdd, expiry) {
  const yy = +yymmdd.slice(0, 2), mm = yymmdd.slice(2, 4), dd = yymmdd.slice(4, 6)
  const nowYY = new Date().getFullYear() % 100
  let century
  if (expiry) century = yy < nowYY + 50 ? 2000 : 1900
  else century = yy <= nowYY ? 2000 : 1900
  return `${century + yy}-${mm}-${dd}`
}

// Parse a raw OCR string into passport fields. Returns null if no valid MRZ.
export function parseMRZ(raw) {
  // Normalise: uppercase, keep MRZ chars, split into 44-char lines.
  const cleaned = (raw || '').toUpperCase().replace(/ /g, '')
  const lines = cleaned.split(/\r?\n/).map(l => l.replace(/[^A-Z0-9<]/g, '')).filter(l => l.length >= 30)
  // Find two consecutive ~44-char lines, the second starting with the number block.
  let l1, l2
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].startsWith('P') && lines[i + 1].length >= 40) { l1 = lines[i]; l2 = lines[i + 1]; break }
  }
  if (!l1 || !l2) return null
  l1 = l1.padEnd(44, '<').slice(0, 44)
  l2 = l2.padEnd(44, '<').slice(0, 44)

  const number = l2.slice(0, 9).replace(/</g, '')
  const numberCD = +l2[9]
  const nationality = l2.slice(10, 13).replace(/</g, '')
  const dob = l2.slice(13, 19)
  const dobCD = +l2[19]
  const sex = l2[20]
  const expiry = l2.slice(21, 27)
  const expiryCD = +l2[27]

  const names = l1.slice(5).split('<<')
  const surname = (names[0] || '').replace(/</g, ' ').trim()
  const given = (names[1] || '').replace(/</g, ' ').trim()

  const valid = {
    number: checkDigit(l2.slice(0, 9)) === numberCD,
    dob: checkDigit(dob) === dobCD,
    expiry: checkDigit(expiry) === expiryCD
  }

  return {
    number,
    nationality,
    sex: sex === 'M' ? 'M' : sex === 'F' ? 'F' : '',
    dob: mrzDateToISO(dob, false),
    expiryDate: mrzDateToISO(expiry, true),
    surname, given,
    fullName: [given, surname].filter(Boolean).join(' '),
    valid,
    allValid: valid.number && valid.dob && valid.expiry
  }
}

// OCR a passport image file and parse its MRZ. Returns parsed fields or null.
export async function scanPassport(file) {
  const { default: Tesseract } = await import('tesseract.js')
  const { data } = await Tesseract.recognize(file, 'eng', {
    // MRZ uses OCR-B; restrict the charset to improve accuracy.
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
  })
  return parseMRZ(data.text)
}
