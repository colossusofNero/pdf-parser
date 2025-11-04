param(
  [Parameter(Mandatory=$true)]
  [string]$WorkbookPath,
  [string]$BackendUrl = "http://localhost:8000",
  [switch]$CheckBackend
)

$ErrorActionPreference = "Stop"

Write-Host "=== STEP 1: Resolve workbook path ==="
if (-not (Test-Path -Path $WorkbookPath)) {
  $tryPath = Join-Path -Path (Get-Location) -ChildPath $WorkbookPath
  if (Test-Path $tryPath) { $WorkbookPath = $tryPath }
}
Write-Host "Workbook path: $WorkbookPath"
if (-not (Test-Path -Path $WorkbookPath)) { throw "Workbook not found at $WorkbookPath" }
Write-Host "Found workbook.`n"

Write-Host "=== STEP 2: Check Python + deps ==="
try {
  $pyver = & python --version
  Write-Host "Python detected: $pyver`n"
} catch {
  throw "Python not detected on PATH."
}

Write-Host "=== STEP 3: Inspect 'Printable Quote' (computed values via cells) ==="
$pyCode = @"
from openpyxl import load_workbook
import sys

path = r'''$WorkbookPath'''
try:
    wb = load_workbook(path, data_only=True)
    if "Printable Quote" not in wb.sheetnames:
        print("[PY] 'Printable Quote' sheet not found.")
        sys.exit(2)

    ws = wb["Printable Quote"]

    def to_num(v):
        if v is None: return 0.0
        if isinstance(v,(int,float)): return float(v)
        s = str(v).strip().replace(",","").replace("$","")
        try: return float(s)
        except: return 0.0

    rows = []
    r = 7
    while True:
        y = ws[f"F{r}"].value
        if y is None:
            break
        try:
            y_num = int(float(y))
        except:
            break
        if not ((1 <= y_num <= 200) or (1900 <= y_num <= 2100)):
            break

        std   = to_num(ws[f"G{r}"].value)
        trad  = to_num(ws[f"H{r}"].value)
        bonus = to_num(ws[f"I{r}"].value)

        rows.append({"year": y_num, "std_dep": std, "trad_cost_seg": trad, "bonus_dep": bonus})
        r += 1

    print(f"[PY] Row count: {len(rows)}")
    if rows:
        print(f"[PY] First: {rows[0]}")
        tstd = sum(x["std_dep"] for x in rows)
        ttrad = sum(x["trad_cost_seg"] for x in rows)
        tbonus = sum(x["bonus_dep"] for x in rows)
        print(f"[PY] Totals: std={tstd:.2f} trad={ttrad:.2f} bonus={tbonus:.2f}")
        sys.exit(0)
    else:
        print("[PY] No rows parsed from Printable Quote by fixed cells.")
        sys.exit(1)
except Exception as e:
    print(f"[PY] Error: {e}")
    sys.exit(3)
"@

$tmpPy = Join-Path $env:TEMP "pq_check.py"
Set-Content -Path $tmpPy -Value $pyCode -Encoding UTF8
& python $tmpPy
$exit = $LASTEXITCODE
Remove-Item $tmpPy -ErrorAction SilentlyContinue

if ($exit -ne 0) { throw "ERROR: Printable Quote inspection (cells) failed." }
Write-Host ""

if ($CheckBackend) {
  Write-Host "=== STEP 4: Backend checks ==="

  # 4a) ping GET /
  try {
    $ping = Invoke-WebRequest -Method GET -Uri "$BackendUrl/" -UseBasicParsing -TimeoutSec 10
    if ($ping.StatusCode -ge 200 -and $ping.StatusCode -lt 300) {
      Write-Host "Backend GET / ok.`n"
    } else {
      throw "GET / returned $($ping.StatusCode)"
    }
  } catch {
    throw "Backend GET / failed: $($_.Exception.Message)"
  }

  # 4b) POST /quote/document with sample payload and summarize schedule
  $body = @{
    inputs = @{
      prospect_name    = "Test Client"
      property_type    = "Multi-Family"
      address          = "123 Any St, Scottsdale"
      tax_deadline     = "October"
      tax_year         = 2025
      purchase_date    = "2024-06-15"
      purchase_price   = 2550000
      known_land_value = $false
      land_value       = 10
      capex_amount     = 0
      sqft_building    = 38000
      acres_land       = 20
    }
    options = @{
      zip_code       = 85260
      rush_label     = "No Rush"
      premium        = "No"
      referral       = "No"
      price_override = $null
    }
  } | ConvertTo-Json -Depth 5

  try {
    $resp = Invoke-RestMethod -Method Post -Uri "$BackendUrl/quote/document" -ContentType "application/json" -Body $body -TimeoutSec 30
    $rows  = ($resp.schedule | Measure-Object).Count
    $std   = ($resp.schedule | Measure-Object -Property std_dep -Sum).Sum
    $trad  = ($resp.schedule | Measure-Object -Property trad_cost_seg -Sum).Sum
    $bonus = ($resp.schedule | Measure-Object -Property bonus_dep -Sum).Sum
    Write-Host ("API schedule: rows={0} | totals: std={1} trad={2} bonus={3}" -f $rows, $std, $trad, $bonus)
  } catch {
    throw "POST /quote/document failed: $($_.Exception.Message)"
  }
}
