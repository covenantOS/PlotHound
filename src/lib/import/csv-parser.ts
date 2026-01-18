// CSV Parser for importing ancestor data from spreadsheets

export interface CsvPerson {
  id: string
  givenNames: string | null
  surname: string | null
  gender: 'male' | 'female' | 'unknown' | null
  birthDate: string | null
  birthPlace: string | null
  deathDate: string | null
  deathPlace: string | null
  fatherId: string | null
  motherId: string | null
  notes: string | null
}

// Column name mappings (case-insensitive)
const COLUMN_MAPPINGS: Record<string, keyof CsvPerson | 'fatherGivenNames' | 'fatherSurname' | 'motherGivenNames' | 'motherSurname'> = {
  // Given names
  'given_names': 'givenNames',
  'givennames': 'givenNames',
  'given names': 'givenNames',
  'first_name': 'givenNames',
  'firstname': 'givenNames',
  'first name': 'givenNames',
  'first': 'givenNames',
  'forename': 'givenNames',
  'forenames': 'givenNames',
  'name': 'givenNames',

  // Surname
  'surname': 'surname',
  'last_name': 'surname',
  'lastname': 'surname',
  'last name': 'surname',
  'last': 'surname',
  'family_name': 'surname',
  'familyname': 'surname',
  'family name': 'surname',

  // Gender
  'gender': 'gender',
  'sex': 'gender',

  // Birth
  'birth_date': 'birthDate',
  'birthdate': 'birthDate',
  'birth date': 'birthDate',
  'born': 'birthDate',
  'dob': 'birthDate',
  'date_of_birth': 'birthDate',
  'birth_year': 'birthDate',
  'birthyear': 'birthDate',

  'birth_place': 'birthPlace',
  'birthplace': 'birthPlace',
  'birth place': 'birthPlace',
  'born_in': 'birthPlace',
  'birth_location': 'birthPlace',

  // Death
  'death_date': 'deathDate',
  'deathdate': 'deathDate',
  'death date': 'deathDate',
  'died': 'deathDate',
  'dod': 'deathDate',
  'date_of_death': 'deathDate',
  'death_year': 'deathDate',
  'deathyear': 'deathDate',

  'death_place': 'deathPlace',
  'deathplace': 'deathPlace',
  'death place': 'deathPlace',
  'died_in': 'deathPlace',
  'death_location': 'deathPlace',

  // Parents
  'father_given_names': 'fatherGivenNames',
  'father_first_name': 'fatherGivenNames',
  'father_name': 'fatherGivenNames',
  'fathers_name': 'fatherGivenNames',

  'father_surname': 'fatherSurname',
  'father_last_name': 'fatherSurname',
  'fathers_surname': 'fatherSurname',

  'mother_given_names': 'motherGivenNames',
  'mother_first_name': 'motherGivenNames',
  'mother_name': 'motherGivenNames',
  'mothers_name': 'motherGivenNames',

  'mother_surname': 'motherSurname',
  'mother_last_name': 'motherSurname',
  'mothers_surname': 'motherSurname',
  'mother_maiden_name': 'motherSurname',

  // Notes
  'notes': 'notes',
  'note': 'notes',
  'comments': 'notes',
  'comment': 'notes',
  'description': 'notes',
}

export function parseCsv(text: string): CsvPerson[] {
  const lines = parseCSVLines(text)
  if (lines.length < 2) return []

  const headers = lines[0].map(h => h.toLowerCase().trim())
  const columnMap = new Map<number, string>()

  // Map column indices to field names
  headers.forEach((header, index) => {
    const mappedField = COLUMN_MAPPINGS[header]
    if (mappedField) {
      columnMap.set(index, mappedField)
    }
  })

  const people: CsvPerson[] = []
  const parentLookup = new Map<string, string>() // "GivenNames Surname" -> id

  // First pass: create all people
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    if (row.every(cell => !cell.trim())) continue // Skip empty rows

    const person: CsvPerson = {
      id: `csv-${i}`,
      givenNames: null,
      surname: null,
      gender: null,
      birthDate: null,
      birthPlace: null,
      deathDate: null,
      deathPlace: null,
      fatherId: null,
      motherId: null,
      notes: null,
    }

    let fatherGivenNames = ''
    let fatherSurname = ''
    let motherGivenNames = ''
    let motherSurname = ''

    row.forEach((value, index) => {
      const field = columnMap.get(index)
      if (!field || !value.trim()) return

      const trimmedValue = value.trim()

      switch (field) {
        case 'givenNames':
          person.givenNames = trimmedValue
          break
        case 'surname':
          person.surname = trimmedValue
          break
        case 'gender':
          person.gender = normalizeGender(trimmedValue)
          break
        case 'birthDate':
          person.birthDate = normalizeDate(trimmedValue)
          break
        case 'birthPlace':
          person.birthPlace = trimmedValue
          break
        case 'deathDate':
          person.deathDate = normalizeDate(trimmedValue)
          break
        case 'deathPlace':
          person.deathPlace = trimmedValue
          break
        case 'notes':
          person.notes = trimmedValue
          break
        case 'fatherGivenNames':
          fatherGivenNames = trimmedValue
          break
        case 'fatherSurname':
          fatherSurname = trimmedValue
          break
        case 'motherGivenNames':
          motherGivenNames = trimmedValue
          break
        case 'motherSurname':
          motherSurname = trimmedValue
          break
      }
    })

    // Skip if no name
    if (!person.givenNames && !person.surname) continue

    // Store for parent lookup
    const personKey = `${person.givenNames || ''} ${person.surname || ''}`.trim()
    if (personKey) {
      parentLookup.set(personKey, person.id)
    }

    // Store parent names for second pass
    ;(person as any)._fatherName = `${fatherGivenNames} ${fatherSurname || person.surname || ''}`.trim()
    ;(person as any)._motherName = `${motherGivenNames} ${motherSurname}`.trim()

    people.push(person)
  }

  // Second pass: link parents
  for (const person of people) {
    const fatherName = (person as any)._fatherName as string
    const motherName = (person as any)._motherName as string

    if (fatherName && parentLookup.has(fatherName)) {
      person.fatherId = parentLookup.get(fatherName)!
    }
    if (motherName && parentLookup.has(motherName)) {
      person.motherId = parentLookup.get(motherName)!
    }

    delete (person as any)._fatherName
    delete (person as any)._motherName
  }

  return people
}

// Parse CSV handling quoted fields
function parseCSVLines(text: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentLine.push(currentField)
        currentField = ''
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentLine.push(currentField)
        lines.push(currentLine)
        currentLine = []
        currentField = ''
        if (char === '\r') i++ // Skip \n in \r\n
      } else if (char !== '\r') {
        currentField += char
      }
    }
  }

  // Add last field and line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField)
    lines.push(currentLine)
  }

  return lines
}

function normalizeGender(value: string): 'male' | 'female' | 'unknown' | null {
  const lower = value.toLowerCase()
  if (['m', 'male', 'man', 'boy'].includes(lower)) return 'male'
  if (['f', 'female', 'woman', 'girl'].includes(lower)) return 'female'
  if (['u', 'unknown', '?', 'other'].includes(lower)) return 'unknown'
  return null
}

function normalizeDate(value: string): string | null {
  if (!value) return null

  // Try common date formats
  const patterns = [
    // YYYY-MM-DD
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    // MM/DD/YYYY
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
    // DD/MM/YYYY (European)
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    // YYYY
    { regex: /^(\d{4})$/, format: (m: RegExpMatchArray) => m[1] },
    // Month DD, YYYY
    { regex: /^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/, format: (m: RegExpMatchArray) => {
      const month = monthToNum(m[1])
      return month ? `${m[3]}-${month}-${m[2].padStart(2, '0')}` : m[0]
    }},
  ]

  for (const { regex, format } of patterns) {
    const match = value.match(regex)
    if (match) return format(match)
  }

  return value // Return as-is if no pattern matches
}

function monthToNum(month: string): string | null {
  const months: Record<string, string> = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sep: '09', sept: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  }
  return months[month.toLowerCase()] || null
}
