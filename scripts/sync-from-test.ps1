# Descarga archivos públicos de https://tvpanel.tallerboedo.com.ar/ (carpeta TEST en hosting)
# Uso: .\scripts\sync-from-test.ps1
# Requiere: acceso HTTP al sitio (no usa credenciales FTP)

$ErrorActionPreference = 'Stop'
$base = 'https://tvpanel.tallerboedo.com.ar'
$root = Split-Path $PSScriptRoot -Parent

function Download-File($rel) {
    $dest = Join-Path $root $rel
    $dir = Split-Path $dest -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Invoke-WebRequest -Uri "$base/$rel" -OutFile $dest -UseBasicParsing
    Write-Host "OK $rel"
}

$static = @(
    'JSON/congelados.json', 'JSON/congelados-img.json', 'JSON/productos.json', 'JSON/ofertas.json', 'JSON/tvs.json',
    'index.html', 'index2.html', 'promociones.html',
    'CSS/styles.css', 'CSS/panel.css', 'CSS/themes/default.css', 'CSS/style-promociones.css',
    'JS/app.js', 'JS/panel.js', 'JS/script-promociones.js',
    'IMG/Logo.png', 'IMG/IsoLogo.png', 'IMG/fondo-carniceria.jpg', 'IMG/qrcode.jpg',
    'IMG/pagos/visa.png', 'IMG/pagos/mastercard.png', 'IMG/pagos/amex.png',
    'IMG/pagos/mercadopago.png', 'IMG/pagos/debito.png', 'IMG/pagos/efectivo.png'
)
foreach ($f in $static) { Download-File $f }

$media = (Get-Content (Join-Path $root 'JSON/congelados-img.json') -Raw | ConvertFrom-Json).images
foreach ($m in $media) { Download-File $m }

node -e @"
const fs=require('fs');const path=require('path');
const root=process.argv[1];
const files=['JSON/ofertas.json'];
const urls=new Set();
for(const f of files){
  const j=JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  const walk=o=>{if(!o||typeof o!=='object')return;for(const v of Object.values(o)){
    if(typeof v==='string'&&v.includes('IMG/CORTES/VIDEO/')) urls.add(v.replace(/^https?:\\/\\/[^/]+\\//,'').replace(/^\\//,''));
    else walk(v);
  }}; walk(j);
}
console.log([...urls].join('\n'));
"@ $root | ForEach-Object { if ($_) { Download-File $_ } }

Write-Host 'Sync listo.'
