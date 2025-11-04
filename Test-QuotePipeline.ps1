<# 
  STATIC: PowerShell script to validate Excel -> schedule -> backend output
  REQUIREMENTS:
    - Python available on PATH
    - Python packages: openpyxl, pandas (pip install openpyxl pandas)
#>

param(
  # REPLACE (double quotes): Set to your backend URL if you want the HTTP test
  [string] $BackendUrl = "http://localhost:8000",

  # REPLACE (double quotes): Path to your workbook (relative or absolute)
  [string] $WorkbookPath = "Base Pricing27.1_Pro_SMART_RCGV.xlsx",

  # STATIC: Toggle whether to call the backend’s /quote/document
  [switch] $CheckBackend
)

Write-Host "=== STEP 1: Resolve workbook path ===" -ForegroundColor Cyan
$here = Split-Path -Parent $MyInvocation.MyCommand.Path  # STATIC
if (-not [System.IO.Path]::IsPathRooted($WorkbookPath)) { # STATIC
  $WorkbookPath = Join-Path $here $WorkbookPath          # STATIC
}
Write-Host ("Workbook path: {0}" -f $WorkbookPath)
if (-not (Test-Path $WorkbookPath)) {
  Write-Host "ERROR: Workbook not found at that path." -ForegroundColor Red
  exit 1
}
Write-Host "Found workbook." -ForegroundColor Green

Write-Host "`n=== STEP 2: Check Python + deps ===" -ForegroundColor Cyan
$pythonOk = $false
try {
  $pyv = & python --version 2>$null
  if ($LASTEXITCODE -eq 0) { $pythonOk = $true }
} catch { }
if (-not $pythonOk) {
  Write-Host "ERROR: Python not found on PATH. Install Python and retry." -ForegroundColor Red
  exit 1
}
Write-Host "Python detected: $pyv" -ForegroundColor Green

Write-Host "`n=== STEP 3: Inspect 'Printable Quote' (computed values) ===" -ForegroundColor Cyan

# STATIC: Python code as a literal here-string (no interpolation)
$py = @'
import sys
from openpyxl import load_workbook

xlsx_path = sys.argv[1]  # STATIC

def to_num(v):
    if v is None: return 0.0
    if isinstance(v, (int,float)): return float(v)
    s = str(v).strip().replace(",", "").replace("$", "")
    try: return float(s)
    except: return 0.0

def norm(v):
    return str(v).strip().lower() if v is not None else ""

wb = load_workbook(xlsx_path, data_only=True)  # STATIC
if "Printable Quote" not in wb.sheetnames:
    print("[PY] Printable Quote sheet missing.")
    sys.exit(2)

ws = wb["Printable Quote"]  # STATIC
max_row, max_col = ws.max_row, ws.max_column
data = [[ws.cell(r,c).value for c in range(1, max_col+1)] for r in range(1, max_row+1)]

wanted = {
  "year": ["year"],
  "std": ["std. dep", "std dep", "standard depreciation"],
  "trad": ["trad. cost seg", "traditional cost seg", "trad cost seg"],
  "bonus": ["bonus dep", "bonus depreciation"]
}

header_row_idx = None
cols = {"year": None, "std": None, "trad": None, "bonus": None}

scan_limit = min(100, len(data))
for r in range(scan_limit):
    row = [norm(c) for c in data[r]]
    found = {}
    for key, needles in wanted.items():
        idx = None
        for i, cell in enumerate(row):
            if cell in needles:
                idx = i
                break
        found[key] = idx
    if all(found[k] is not None for k in found):
        header_row_idx = r
        cols["year"], cols["std"], cols["trad"], cols["bonus"] = found["year"], found["std"], found["trad"], found["bonus"]
        break

if header_row_idx is None:
    print("[PY] Could not find header row with Year / Std. Dep / Trad. Cost Seg / Bonus Dep.")
    sys.exit(3)

rows = []
r = header_row_idx + 1
while r < len(data):
    y = data[r][cols["year"]]
    try:
        y_num = int(float(y))
    except:
        break
    if y_num < 1 or y_num > 100: break

    std = to_num(data[r][cols["std"]])
    trad = to_num(data[r][cols["trad"]])
    bonus = to_num(data[r][cols["bonus"]])

    rows.append({"year": y_num, "std_dep": std, "trad_cost_seg": trad, "bonus_dep": bonus})
    r += 1

print("[PY] Header row:", header_row_idx)
print("[PY] Columns:", cols)
if rows:
    print("[PY] First data row:", rows[0])
print("[PY] Row count:", len(rows))
print("[PY] Totals: std={:.2f} trad={:.2f} bonus={:.2f}".format(
    sum(x["std_dep"] for x in rows), sum(x["trad_cost_seg"] for x in rows), sum(x["bonus_dep"] for x in rows)
))
'@

# STATIC: Write Python to a temp file and execute with the workbook path
$tempPy = Join-Path $env:TEMP ("pq_inspect_{0}.py" -f ([guid]::NewGuid()))
Set-Content -Path $tempPy -Value $py -Encoding UTF8  # STATIC

& python $tempPy $WorkbookPath
$pyExit = $LASTEXITCODE
Remove-Item $tempPy -Force -ErrorAction SilentlyContinue  # STATIC

if ($pyExit -ne 0) {
  Write-Host "ERROR: Printable Quote inspection failed (see [PY] lines above)." -ForegroundColor Red
  exit 1
} else {
  Write-Host "Printable Quote inspection OK." -ForegroundColor Green
}

if ($CheckBackend) {
  Write-Host "`n=== STEP 4 (optional): Call backend /quote/document ===" -ForegroundColor Cyan

  # REPLACE (double quotes): Minimal payload your backend expects; adjust as needed
  $body = @{
    inputs = @{
      prospect_name    = "Test Client";            # STATIC (string)
      property_type    = "Multi-Family";           # STATIC (string)
      address          = "123 Any St, Scottsdale"; # STATIC (string)
      tax_deadline     = "October";                # STATIC (string)
      tax_year         = 2025;                     # STATIC (number)
      purchase_date    = "2024-06-15";             # STATIC (ISO date string)
      purchase_price   = 2550000;                  # STATIC (number)
      known_land_value = $false;                   # STATIC (bool)
      land_value       = 10;                       # STATIC (percent since known_land_value=false)
      capex_amount     = 0;                        # STATIC (number)
      sqft_building    = 38000;                    # STATIC (number)
      acres_land       = 20                        # STATIC (number)
    };
    options = @{
      zip_code       = 85260;                      # STATIC (number)
      rush_label     = "No Rush";                  # STATIC (string)
      premium        = "No";                       # STATIC ("Yes"/"No")
      referral       = "No";                       # STATIC ("Yes"/"No")
      price_override = $null                       # STATIC (null or number)
    }
  } | ConvertTo-Json -Depth 5

  # STATIC: Test GET / (don’t assign to unused var)
  try {
    Invoke-RestMethod -Method GET -Uri ($BackendUrl + "/") -TimeoutSec 10 | Out-Null
    Write-Host "Backend GET / ok." -ForegroundColor Green
  } catch {
    Write-Host "WARN: GET / failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  try {
    $resp = Invoke-RestMethod -Method Post -Uri ($BackendUrl + "/quote/document") `
             -ContentType "application/json" -Body $body -TimeoutSec 30
    $rows = ($resp.schedule | Measure-Object).Count
    $std  = 0; $trad = 0; $bonus = 0
    if ($rows -gt 0) {
      $std  = ($resp.schedule | Measure-Object -Property std_dep -Sum).Sum
      $trad = ($resp.schedule | Measure-Object -Property trad_cost_seg -Sum).Sum
      $bonus= ($resp.schedule | Measure-Object -Property bonus_dep -Sum).Sum
    }
    Write-Host ("Schedule rows: {0} | totals: std={1} trad={2} bonus={3}" -f $rows, $std, $trad, $bonus)
    if ($rows -eq 0) {
      Write-Host "Backend returned EMPTY schedule → the UI will show $0 totals." -ForegroundColor Yellow
    } else {
      Write-Host "Backend schedule looks good." -ForegroundColor Green
    }
  } catch {
    Write-Host "ERROR: POST /quote/document failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}
