'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  TreePine,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
} from 'lucide-react'
import { parseGedcom, type GedcomPerson } from '@/lib/import/gedcom-parser'
import { parseCsv, type CsvPerson } from '@/lib/import/csv-parser'

type ImportStep = 'select' | 'upload' | 'preview' | 'importing' | 'complete'

interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>('select')
  const [importType, setImportType] = useState<'gedcom' | 'csv' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [treeId, setTreeId] = useState<string>('')
  const [treeName, setTreeName] = useState<string>('')
  const [createNewTree, setCreateNewTree] = useState(true)
  const [trees, setTrees] = useState<{ id: string; name: string }[]>([])
  const [parsedData, setParsedData] = useState<(GedcomPerson | CsvPerson)[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  // Load existing trees
  const loadTrees = useCallback(async () => {
    const { data } = await supabase.from('trees').select('id, name').order('name')
    if (data) setTrees(data)
  }, [supabase])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setIsLoading(true)

    try {
      const text = await selectedFile.text()

      if (importType === 'gedcom') {
        const people = parseGedcom(text)
        setParsedData(people)
      } else if (importType === 'csv') {
        const people = parseCsv(text)
        setParsedData(people)
      }

      await loadTrees()
      setStep('preview')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Parse Error',
        description: error instanceof Error ? error.message : 'Failed to parse file',
      })
    }

    setIsLoading(false)
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return

    setStep('importing')
    setImportProgress(0)

    const errors: string[] = []
    let importedCount = 0
    let skippedCount = 0

    try {
      // Create or use existing tree
      let targetTreeId = treeId

      if (createNewTree) {
        const { data: newTree, error: treeError } = await supabase
          .from('trees')
          .insert({ name: treeName || file?.name?.replace(/\.[^/.]+$/, '') || 'Imported Tree' })
          .select()
          .single()

        if (treeError) throw treeError
        targetTreeId = newTree.id
      }

      // Import ancestors in batches
      const batchSize = 10
      const totalBatches = Math.ceil(parsedData.length / batchSize)

      // First pass: Create all ancestors without parent references
      const idMap = new Map<string, string>() // old ID -> new ID

      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize)

        for (const person of batch) {
          try {
            const ancestorData = {
              tree_id: targetTreeId,
              given_names: person.givenNames || null,
              surname: person.surname || null,
              gender: person.gender || null,
              birth_date: person.birthDate || null,
              birth_place: person.birthPlace || null,
              death_date: person.deathDate || null,
              death_place: person.deathPlace || null,
              notes: person.notes || null,
            }

            const { data: newAncestor, error } = await supabase
              .from('ancestors')
              .insert(ancestorData)
              .select()
              .single()

            if (error) {
              errors.push(`Failed to import ${person.givenNames} ${person.surname}: ${error.message}`)
              skippedCount++
            } else {
              idMap.set(person.id, newAncestor.id)
              importedCount++
            }
          } catch (err) {
            errors.push(`Error importing ${person.givenNames} ${person.surname}`)
            skippedCount++
          }
        }

        setImportProgress(Math.round(((i + batch.length) / parsedData.length) * 50))
      }

      // Second pass: Update parent relationships
      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize)

        for (const person of batch) {
          const newId = idMap.get(person.id)
          if (!newId) continue

          const updates: Record<string, string | null> = {}

          if (person.fatherId && idMap.has(person.fatherId)) {
            updates.father_id = idMap.get(person.fatherId)!
          }
          if (person.motherId && idMap.has(person.motherId)) {
            updates.mother_id = idMap.get(person.motherId)!
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from('ancestors').update(updates).eq('id', newId)
          }
        }

        setImportProgress(50 + Math.round(((i + batch.length) / parsedData.length) * 50))
      }

      setResult({
        total: parsedData.length,
        imported: importedCount,
        skipped: skippedCount,
        errors: errors.slice(0, 10), // Only show first 10 errors
      })

      setStep('complete')

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${importedCount} ancestors.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
      setStep('preview')
    }
  }

  const downloadTemplate = () => {
    const headers = 'given_names,surname,gender,birth_date,birth_place,death_date,death_place,father_given_names,father_surname,mother_given_names,mother_surname,notes'
    const example = 'John,Smith,male,1850-03-15,Boston Massachusetts,1920-11-22,New York City,William,Smith,Mary,Johnson,Example ancestor'
    const csv = `${headers}\n${example}`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plothound_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header title="Import Ancestors" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {step === 'select' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
                <h2 className="font-serif text-2xl font-bold">Import Your Family Tree</h2>
                <p className="text-muted-foreground mt-2">
                  Quickly add ancestors from Ancestry, FamilySearch, or a spreadsheet
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card
                  className={`cursor-pointer transition-all hover:border-primary ${importType === 'gedcom' ? 'border-primary ring-2 ring-primary/20' : ''}`}
                  onClick={() => setImportType('gedcom')}
                >
                  <CardHeader>
                    <FileText className="h-10 w-10 text-primary mb-2" />
                    <CardTitle>GEDCOM File</CardTitle>
                    <CardDescription>
                      Import from Ancestry, FamilySearch, MyHeritage, or any genealogy software
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Standard .ged format supported by all major genealogy platforms
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all hover:border-primary ${importType === 'csv' ? 'border-primary ring-2 ring-primary/20' : ''}`}
                  onClick={() => setImportType('csv')}
                >
                  <CardHeader>
                    <FileSpreadsheet className="h-10 w-10 text-primary mb-2" />
                    <CardTitle>CSV / Excel</CardTitle>
                    <CardDescription>
                      Import from a spreadsheet with your ancestor data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadTemplate()
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download template
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  disabled={!importType}
                  onClick={() => setStep('upload')}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setStep('select')}>
                ← Back
              </Button>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Upload {importType === 'gedcom' ? 'GEDCOM' : 'CSV'} File
                  </CardTitle>
                  <CardDescription>
                    {importType === 'gedcom'
                      ? 'Export a .ged file from Ancestry, FamilySearch, or your genealogy software'
                      : 'Upload a CSV file with your ancestor data'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Input
                      type="file"
                      accept={importType === 'gedcom' ? '.ged,.gedcom' : '.csv,.txt'}
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      disabled={isLoading}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {isLoading ? (
                        <Loader2 className="h-12 w-12 text-muted-foreground mx-auto animate-spin" />
                      ) : (
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                      )}
                      <p className="mt-4 text-sm text-muted-foreground">
                        {isLoading
                          ? 'Parsing file...'
                          : `Click to upload or drag and drop your ${importType === 'gedcom' ? '.ged' : '.csv'} file`}
                      </p>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                ← Back
              </Button>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    {parsedData.length} Ancestors Found
                  </CardTitle>
                  <CardDescription>
                    Review and import your ancestors
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-h-48 overflow-auto border rounded-md p-3">
                    {parsedData.slice(0, 20).map((person, i) => (
                      <div key={i} className="text-sm py-1 border-b last:border-0">
                        {person.givenNames} {person.surname}
                        {person.birthDate && ` (b. ${person.birthDate})`}
                      </div>
                    ))}
                    {parsedData.length > 20 && (
                      <p className="text-sm text-muted-foreground pt-2">
                        And {parsedData.length - 20} more...
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <Label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={createNewTree}
                          onChange={() => setCreateNewTree(true)}
                        />
                        Create new tree
                      </Label>
                      <Label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={!createNewTree}
                          onChange={() => setCreateNewTree(false)}
                        />
                        Add to existing tree
                      </Label>
                    </div>

                    {createNewTree ? (
                      <div className="space-y-2">
                        <Label htmlFor="tree-name">Tree Name</Label>
                        <Input
                          id="tree-name"
                          placeholder="My Family Tree"
                          value={treeName}
                          onChange={(e) => setTreeName(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Select Tree</Label>
                        <Select value={treeId} onValueChange={setTreeId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a tree" />
                          </SelectTrigger>
                          <SelectContent>
                            {trees.map((tree) => (
                              <SelectItem key={tree.id} value={tree.id}>
                                {tree.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleImport}
                    disabled={!createNewTree && !treeId}
                  >
                    <TreePine className="mr-2 h-5 w-5" />
                    Import {parsedData.length} Ancestors
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'importing' && (
            <Card>
              <CardHeader>
                <CardTitle>Importing Ancestors...</CardTitle>
                <CardDescription>
                  Please wait while we import your family tree
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={importProgress} />
                <p className="text-center text-sm text-muted-foreground">
                  {importProgress}% complete
                </p>
              </CardContent>
            </Card>
          )}

          {step === 'complete' && result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Import Complete!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-primary">{result.imported}</p>
                    <p className="text-sm text-muted-foreground">Imported</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-muted-foreground">{result.skipped}</p>
                    <p className="text-sm text-muted-foreground">Skipped</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{result.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="bg-destructive/10 rounded-md p-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Some issues occurred:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      {result.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button className="flex-1" onClick={() => router.push('/dashboard')}>
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setStep('select')
                      setFile(null)
                      setParsedData([])
                      setResult(null)
                    }}
                  >
                    Import More
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
