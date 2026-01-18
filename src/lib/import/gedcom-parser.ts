// GEDCOM Parser for importing family tree data
// Supports GEDCOM 5.5 and 5.5.1 formats (Ancestry, FamilySearch, MyHeritage, etc.)

export interface GedcomPerson {
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

interface GedcomFamily {
  id: string
  husbandId: string | null
  wifeId: string | null
  childIds: string[]
}

export function parseGedcom(text: string): GedcomPerson[] {
  const lines = text.split(/\r?\n/)
  const individuals: Map<string, GedcomPerson> = new Map()
  const families: Map<string, GedcomFamily> = new Map()

  let currentId: string | null = null
  let currentType: 'INDI' | 'FAM' | null = null
  let currentTag: string | null = null
  let currentPerson: Partial<GedcomPerson> = {}
  let currentFamily: Partial<GedcomFamily> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse GEDCOM line: LEVEL [XREF] TAG [VALUE]
    const match = line.match(/^(\d+)\s+(@[^@]+@\s+)?(\S+)(\s+(.*))?$/)
    if (!match) continue

    const level = parseInt(match[1], 10)
    const xref = match[2]?.trim()
    const tag = match[3]
    const value = match[5]?.trim() || ''

    // Level 0: New record
    if (level === 0) {
      // Save previous record
      if (currentType === 'INDI' && currentId) {
        individuals.set(currentId, {
          id: currentId,
          givenNames: currentPerson.givenNames || null,
          surname: currentPerson.surname || null,
          gender: currentPerson.gender || null,
          birthDate: currentPerson.birthDate || null,
          birthPlace: currentPerson.birthPlace || null,
          deathDate: currentPerson.deathDate || null,
          deathPlace: currentPerson.deathPlace || null,
          fatherId: null,
          motherId: null,
          notes: currentPerson.notes || null,
        })
      } else if (currentType === 'FAM' && currentId) {
        families.set(currentId, {
          id: currentId,
          husbandId: currentFamily.husbandId || null,
          wifeId: currentFamily.wifeId || null,
          childIds: currentFamily.childIds || [],
        })
      }

      // Start new record
      currentPerson = {}
      currentFamily = { childIds: [] }
      currentTag = null

      if (tag === 'INDI' && xref) {
        currentType = 'INDI'
        currentId = xref
      } else if (tag === 'FAM' && xref) {
        currentType = 'FAM'
        currentId = xref
      } else {
        currentType = null
        currentId = null
      }
      continue
    }

    // Process individual data
    if (currentType === 'INDI') {
      if (level === 1) {
        currentTag = tag

        switch (tag) {
          case 'NAME':
            // Parse name: "Given Names /Surname/"
            const nameMatch = value.match(/^([^/]*)\s*\/([^/]*)\/?/)
            if (nameMatch) {
              currentPerson.givenNames = nameMatch[1].trim() || null
              currentPerson.surname = nameMatch[2].trim() || null
            } else {
              currentPerson.givenNames = value || null
            }
            break
          case 'SEX':
            currentPerson.gender = value === 'M' ? 'male' : value === 'F' ? 'female' : 'unknown'
            break
          case 'NOTE':
            currentPerson.notes = value || null
            break
        }
      } else if (level === 2 && currentTag) {
        switch (currentTag) {
          case 'BIRT':
            if (tag === 'DATE') currentPerson.birthDate = normalizeDate(value)
            if (tag === 'PLAC') currentPerson.birthPlace = value
            break
          case 'DEAT':
            if (tag === 'DATE') currentPerson.deathDate = normalizeDate(value)
            if (tag === 'PLAC') currentPerson.deathPlace = value
            break
          case 'NAME':
            if (tag === 'GIVN') currentPerson.givenNames = value
            if (tag === 'SURN') currentPerson.surname = value
            break
          case 'NOTE':
            if (tag === 'CONT' || tag === 'CONC') {
              currentPerson.notes = (currentPerson.notes || '') + (tag === 'CONT' ? '\n' : '') + value
            }
            break
        }
      }
    }

    // Process family data
    if (currentType === 'FAM') {
      if (level === 1) {
        switch (tag) {
          case 'HUSB':
            currentFamily.husbandId = value
            break
          case 'WIFE':
            currentFamily.wifeId = value
            break
          case 'CHIL':
            currentFamily.childIds = currentFamily.childIds || []
            currentFamily.childIds.push(value)
            break
        }
      }
    }
  }

  // Save last record
  if (currentType === 'INDI' && currentId) {
    individuals.set(currentId, {
      id: currentId,
      givenNames: currentPerson.givenNames || null,
      surname: currentPerson.surname || null,
      gender: currentPerson.gender || null,
      birthDate: currentPerson.birthDate || null,
      birthPlace: currentPerson.birthPlace || null,
      deathDate: currentPerson.deathDate || null,
      deathPlace: currentPerson.deathPlace || null,
      fatherId: null,
      motherId: null,
      notes: currentPerson.notes || null,
    })
  } else if (currentType === 'FAM' && currentId) {
    families.set(currentId, {
      id: currentId,
      husbandId: currentFamily.husbandId || null,
      wifeId: currentFamily.wifeId || null,
      childIds: currentFamily.childIds || [],
    })
  }

  // Link parents to children
  for (const family of families.values()) {
    for (const childId of family.childIds) {
      const child = individuals.get(childId)
      if (child) {
        if (family.husbandId) child.fatherId = family.husbandId
        if (family.wifeId) child.motherId = family.wifeId
      }
    }
  }

  return Array.from(individuals.values())
}

// Normalize various date formats to YYYY-MM-DD or partial dates
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Remove common prefixes
  dateStr = dateStr
    .replace(/^(ABT|ABOUT|CIRCA|CA|C|BEF|BEFORE|AFT|AFTER|EST|ESTIMATED)\s*/i, '')
    .trim()

  // Try to parse various formats
  const patterns = [
    // DD MMM YYYY
    {
      regex: /^(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})$/i,
      format: (m: RegExpMatchArray) => `${m[3]}-${monthToNum(m[2])}-${m[1].padStart(2, '0')}`,
    },
    // MMM YYYY
    {
      regex: /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})$/i,
      format: (m: RegExpMatchArray) => `${m[2]}-${monthToNum(m[1])}`,
    },
    // YYYY
    {
      regex: /^(\d{4})$/,
      format: (m: RegExpMatchArray) => m[1],
    },
    // MM/DD/YYYY or DD/MM/YYYY
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      format: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`,
    },
    // YYYY-MM-DD (already normalized)
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})$/,
      format: (m: RegExpMatchArray) => m[0],
    },
  ]

  for (const { regex, format } of patterns) {
    const match = dateStr.match(regex)
    if (match) {
      return format(match)
    }
  }

  // Return as-is if no pattern matches
  return dateStr
}

function monthToNum(month: string): string {
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04',
    MAY: '05', JUN: '06', JUL: '07', AUG: '08',
    SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  }
  return months[month.toUpperCase()] || '01'
}
