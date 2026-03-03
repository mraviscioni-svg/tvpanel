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
| `FTP_SERVER_DIR`  | Carpeta remota (siempre terminar en `/`) | **Si al conectar ves la carpeta TALLERBOEDO y dentro está TEST**, usá **`TEST/`** (así los archivos van a TEST/backend, TEST/JSON, etc.). Si caés directo en TEST, usá `./` |

**Resumen:** Al conectarte por FTP caés en un directorio raíz (tipo “public”). Ese es el lugar. Poné en `FTP_SERVER_DIR` esa ruta con `/` al final: si desplegás ahí mismo, usá `./`; si desplegás en una subcarpeta (ej. TEST), usá `TEST/`.

Si tu hosting usa **FTP seguro (FTPS)**, editá `.github/workflows/deploy-ftp.yml` y cambiá `protocol: ftp` por `protocol: ftps`.

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

---

### Error FTP 553: "Can't open that file: No such file or directory"

El servidor no puede crear o escribir el archivo. Hacé esto **en este orden**:

1. **Crear la carpeta de deploy a mano (una sola vez)**  
   Conectate por FTP (FileZilla, etc.) y en la raíz donde caés (tu “public”):
   - Creá la carpeta donde va el proyecto (ej. `TEST` o usá la raíz).
   - Dentro de esa carpeta, creá estas carpetas **vacías**:  
     `backend`, `JSON`, `CORTES`, `VIDEO` (esta última dentro de `CORTES`), `uploads`, y dentro de `uploads` una carpeta `ofertas`.  
   Así: `TEST/backend`, `TEST/JSON`, `TEST/CORTES`, `TEST/CORTES/VIDEO`, `TEST/uploads`, `TEST/uploads/ofertas`.

2. **Permisos**  
   Esa carpeta (ej. `TEST`) y las que creaste: **755** (o 775 si el hosting lo pide).

3. **Secreto FTP_SERVER_DIR**  
   En GitHub, el valor de `FTP_SERVER_DIR` tiene que ser **exactamente** esa carpeta, con `/` al final:
   - Si desplegás en la raíz donde caés: `./` o `/`.
   - Si desplegás en `TEST`: `TEST/`.
   - Si caés en `public_html` y el proyecto va en `public_html/TEST`: `TEST/` o `public_html/TEST/` según cómo te muestre el FTP.

4. **Volver a correr el deploy**  
   Actions → Deploy to FTP → Run workflow. Con la estructura ya creada y permisos correctos, el 553 suele desaparecer.

5. **Ver qué archivo falla**  
   En el log del workflow, con `log-level: verbose` vas a ver el último archivo que intentaba subir cuando salió el 553; así podés ver si falla en la raíz o en una subcarpeta.
