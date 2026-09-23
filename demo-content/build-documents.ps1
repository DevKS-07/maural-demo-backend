<#
  Builds the demo tenant's documents from the HTML sources in this folder.

    pwsh -File demo-content/build-documents.ps1
    powershell -File demo-content/build-documents.ps1

  Output goes to uploads/, which is gitignored — the binaries are reproducible
  from the tracked sources, so they are not committed.

  Conversion uses Word COM automation rather than pandoc or LibreOffice,
  neither of which is installed, and rather than adding a PDF/DOCX writer to
  package.json. That keeps the lockfile untouched. Word and Excel are both
  available on this machine; the spreadsheet is built separately by
  build-xlsx.js using the `xlsx` package, which is already a dependency.

  Requires Microsoft Word. If this is ever run somewhere without it, the
  sources are plain HTML and can be converted by any other means.
#>

$ErrorActionPreference = "Stop"

$root      = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $root "demo-content\documents"
$outDir    = Join-Path $root "uploads"

# Word SaveAs format constants
$wdFormatXMLDocument = 16   # .docx
$wdFormatPDF         = 17   # .pdf

$documents = @(
  @{ Source = "01-fy2026-strategic-plan.html";                Output = "FY2026 Strategic Plan - Recurring Revenue Transition.pdf"; Format = $wdFormatPDF },
  @{ Source = "02-q2-2026-quarterly-business-review.html";    Output = "Q2 2026 Quarterly Business Review.docx";                   Format = $wdFormatXMLDocument },
  @{ Source = "04-mbcx-delivery-standard.html";               Output = "MBCx Delivery Standard v3.pdf";                           Format = $wdFormatPDF },
  @{ Source = "05-client-msa-template.html";                  Output = "Client Master Services Agreement - Template.docx";        Format = $wdFormatXMLDocument },
  @{ Source = "06-leadership-meeting-notes-2026-09-08.html";  Output = "Leadership Team Meeting Notes - 8 Sep 2026.docx";         Format = $wdFormatXMLDocument }
)

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

Write-Host "[docs] Starting Word..."
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0   # wdAlertsNone

try {
  foreach ($doc in $documents) {
    $sourcePath = Join-Path $sourceDir $doc.Source
    $outputPath = Join-Path $outDir $doc.Output

    if (-not (Test-Path $sourcePath)) {
      throw "Source not found: $sourcePath"
    }

    # ReadOnly so a failed run cannot modify the tracked source.
    # Arguments are passed directly: the [ref] form is a VBScript idiom that
    # PowerShell's COM binder rejects with a psobject conversion error.
    $opened = $word.Documents.Open($sourcePath, $false, $true)
    try {
      $opened.SaveAs([string]$outputPath, [int]$doc.Format)
      Write-Host "[docs] $($doc.Source)  ->  $($doc.Output)"
    }
    finally {
      $opened.Close(0)   # wdDoNotSaveChanges
    }
  }
}
finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Host "[docs] Building spreadsheet..."
& node (Join-Path $PSScriptRoot "build-xlsx.js")

Write-Host ""
Write-Host "[docs] Done. Output in uploads\:"
Get-ChildItem $outDir -File | Where-Object { $_.Name -ne ".gitkeep" } |
  Sort-Object Name |
  ForEach-Object { "{0,10:N0} KB   {1}" -f ($_.Length / 1KB), $_.Name }
