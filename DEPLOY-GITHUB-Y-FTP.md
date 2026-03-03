# Deploy a GitHub y al hosting por FTP

Este proyecto está preparado para:

1. **Subir cambios a GitHub** (push desde tu PC).
2. **Desplegar al hosting por FTP** de forma automática cada vez que hagas push a `main`, o manualmente cuando quieras.

---

## Parte 1: Deploy a GitHub (push)

Cada vez que quieras guardar tu código en GitHub:

```powershell
cd "c:\Users\marcelo.raviscioni\Desktop\TVPANEL"
git add .
git commit -m "Descripción del cambio"
git push origin main
```

Si ya tenés el repo conectado, con eso alcanza. El código queda en:  
https://github.com/mraviscioni-svg/tvpanel

---

## Parte 2: Deploy automático al hosting por FTP

Cada vez que hagas **push a la rama `main`**, GitHub Actions sube el proyecto a tu hosting por FTP (solo los archivos que cambiaron).

### Paso 1: Crear los secretos en GitHub

1. Entrá a tu repo: **https://github.com/mraviscioni-svg/tvpanel**
2. **Settings** → **Secrets and variables** → **Actions**
3. Clic en **New repository secret** y agregá estos **4 secretos** (con los datos que te dio tu hosting):

| Nombre del secreto | Valor | Ejemplo |
|--------------------|--------|---------|
| `FTP_SERVER`       | Servidor FTP (sin `ftp://`) | `ftp.midominio.com` o la IP |
| `FTP_USERNAME`     | Usuario FTP                 | `tu_usuario` |
| `FTP_PASSWORD`     | Contraseña FTP              | tu contraseña |
| `FTP_SERVER_DIR`  | Carpeta remota (debe terminar en `/`) | `public_html/` o `public_html/tvpanel/` |

Si tu hosting usa **FTP seguro (FTPS)**, editá el archivo `.github/workflows/deploy-ftp.yml` y cambiá `protocol: ftp` por `protocol: ftps`.

### Paso 2: Subir el workflow a GitHub

Si acabás de crear el workflow, subilo con un push:

```powershell
git add .github/workflows/deploy-ftp.yml
git add DEPLOY-GITHUB-Y-FTP.md
git commit -m "Deploy automático a FTP"
git push origin main
```

A partir de ese momento, **cada push a `main`** dispara el deploy a FTP.

### Paso 3: Ver que el deploy funcionó

1. En el repo, andá a la pestaña **Actions**.
2. Ahí vas a ver el workflow **"Deploy to FTP"**.
3. Si terminó en verde, los archivos se subieron al hosting.

### Ejecutar el deploy solo cuando quieras (manual)

1. **Actions** → **Deploy to FTP**.
2. Clic en **Run workflow** → **Run workflow**.
3. Se ejecuta un deploy sin hacer push.

---

## Qué se sube por FTP y qué no

**Se sube:**

- `backend/` (todos los PHP y `config.json`)
- `JSON/` (users.json, productos.json, ofertas.json, tvs.json, .htaccess)
- `uploads/` (incluida la carpeta `ofertas`, vacía o con .gitkeep)
- Archivos en la raíz (por ejemplo `index2.html`, `promociones.html`, `DESPLIEGUE-HOSTING.md`, etc.)

**No se sube:**

- `.git/` y `.github/` (solo el workflow corre en GitHub, no se sube la carpeta)
- Carpeta `data/` (la vieja; en el servidor se usa `JSON/`)
- `node_modules/`, `.gitignore`, `PASOS-CONECTAR-GITHUB.md`, `conectar-github.ps1`

---

## Resumen del flujo

| Querés… | Hacé esto |
|--------|------------|
| Guardar código en GitHub | `git add .` → `git commit -m "..."` → `git push origin main` |
| Subir al hosting por FTP | El mismo push dispara el deploy. O en GitHub: Actions → Deploy to FTP → Run workflow |
| Solo probar en el hosting sin push | Ejecutá el workflow manualmente (Actions → Deploy to FTP → Run workflow) después de haber hecho al menos un deploy exitoso |

Si el deploy falla, revisá en **Actions** el log del workflow (el paso "Deploy to FTP") y comprobá que `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` y `FTP_SERVER_DIR` estén bien configurados en los secretos del repo.
