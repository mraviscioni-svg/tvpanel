# Conectar TVPANEL con la versión online de GitHub

## Opción rápida (recomendada)

1. **Instalá Git** (una sola vez):  
   → https://git-scm.com/download/win  
   Durante la instalación elegí **"Git from the command line and also from 3rd-party software"**.  
   Cerrá y volvé a abrir Cursor después.

2. **Configurá tu nombre y email** (solo la primera vez que usás Git):
   ```powershell
   git config --global user.name "Marcelo Raviscioni"
   git config --global user.email "tu@email.com"
   ```

3. **Ejecutá el script** que conecta todo con GitHub:
   - Abrí PowerShell, entrá a esta carpeta y ejecutá:
   ```powershell
   cd "c:\Users\marcelo.raviscioni\Desktop\TVPANEL"
   .\conectar-github.ps1
   ```
   O: clic derecho en `conectar-github.ps1` → **Ejecutar con PowerShell**.

Listo: tu carpeta queda conectada a https://github.com/mraviscioni-svg/tvpanel

---

## Si preferís los comandos a mano

Después de tener Git instalado y configurado:

```powershell
cd "c:\Users\marcelo.raviscioni\Desktop\TVPANEL"
git init
git remote add origin https://github.com/mraviscioni-svg/tvpanel.git
git branch -M main
git add .
git commit -m "Initial commit: proyecto TVPANEL"
git pull origin main --allow-unrelated-histories
git push -u origin main
```
