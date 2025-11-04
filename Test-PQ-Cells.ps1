param(
  [string] $WorkbookPath = "Base Pricing27.1_Pro_SMART_RCGV.xlsx"
)

Write-Host "Reading Printable Quote by fixed cells (F/G/H/I from row 7)..." -ForegroundColor Cyan

$py = @'
import sys
from openpyxl import load_workbook

xlsx_path = sys.argv[1]
wb = load_workbook(xlsx_path, data_only=True)
if "Printable Quote" not in wb.sheetnames:
    print("[PY] Sheet 'Printable Quote' not found"); sys.exit(2)
ws = wb["Printable Quote"]

def to_num(v):
    if v is None: return 0.0
    if isinstance(v,(int,float)): return float(v)
    s = str(v).strip().replace(",","").replace("$","")
    try: return float(s)
    except: return 0.0

rows=[]
r=7  # Start at row 7 as you specified (G7/H7/I7 are first values)
while True:
    year_cell = ws[f"F{r}"].value  # Year column guess: F
    if year_cell is None: break
    try:
        y = int(float(year_cell))
    except:
        break
    std   = to_num(ws[f"G{r}"].value)  # Std. Dep first value at G7
    trad  = to_num(ws[f"H{r}"].value)  # Trad. Cost Seg first value at H7
    bonus = to_num(ws[f"I{r}"].value)  # Bonus Dep first value at I7
    rows.append({"year": y, "std_dep": std, "trad_cost_seg": trad, "bonus_dep": bonus})
    r += 1

print("[PY] Row count:", len(rows))
if rows:
    print("[PY] First:", rows[0])
print("[PY] Totals: std={:.2f} trad={:.2f} bonus={:.2f}".format(
    sum(x["std_dep"] for x in rows),
    sum(x["trad_cost_seg"] for x in rows),
    sum(x["bonus_dep"] for x in rows)
))
'@

$tempPy = Join-Path $env:TEMP ("pq_cells_{0}.py" -f ([guid]::NewGuid()))
Set-Content -Path $tempPy -Value $py -Encoding UTF8
& python $tempPy $WorkbookPath
Remove-Item $tempPy -Force -ErrorAction SilentlyContinue
