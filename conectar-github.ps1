# Conectar TVPANEL con GitHub (ejecutar después de instalar Git)
# Clic derecho -> "Ejecutar con PowerShell" o abrir PowerShell aquí y: .\conectar-github.ps1

$ErrorActionPreference = "Stop"
$repoUrl = "https://github.com/mraviscioni-svg/tvpanel.git"

Set-Location $PSScriptRoot

Write-Host "Conectando con GitHub..." -ForegroundColor Cyan

# Inicializar repo si no existe
if (-not (Test-Path ".git")) {
    git init
    Write-Host "Repo inicializado." -ForegroundColor Green
}

# Agregar remote si no existe
$remotes = git remote 2>$null
if ($remotes -notmatch "origin") {
    git remote add origin $repoUrl
    Write-Host "Remote 'origin' agregado." -ForegroundColor Green
} else {
    git remote set-url origin $repoUrl
    Write-Host "Remote 'origin' actualizado." -ForegroundColor Green
}

git branch -M main

# Traer lo que haya en GitHub (por si tiene .gitkeep u otro contenido)
Write-Host "Sincronizando con GitHub..." -ForegroundColor Cyan
try {
    git pull origin main --allow-unrelated-histories --no-edit 2>$null
} catch {
    # Si falla (ej. repo vacío), no pasa nada
}

git add .
$status = git status --short
if ($status) {
    git commit -m "Sync: proyecto TVPANEL local con GitHub"
    git push -u origin main
    Write-Host "Listo: subido a GitHub." -ForegroundColor Green
} else {
    git push -u origin main 2>$null
    Write-Host "Listo: conectado a GitHub (sin cambios nuevos que subir)." -ForegroundColor Green
}

Write-Host "`nRepositorio en línea: $repoUrl" -ForegroundColor Cyan
