# Cómo conectar TVPANEL a tu hosting

Guía paso a paso para subir el proyecto a un hosting con PHP (cPanel, Plesk, o similar).

---

## 1. Qué necesitás en el hosting

- **PHP** 7.4 o superior (con extensiones: json, session, fileinfo).
- Acceso por **FTP/SFTP** o **Administrador de archivos** (cPanel, etc.).
- Opcional: **Apache** con mod_rewrite (no obligatorio para este backend).

---

## 2. Estructura que debe quedar en el servidor

En el servidor tenés una carpeta que es la “raíz web” (suele llamarse `public_html`, `www`, `httpdocs` o similar). Ahí vas a subir **todo el proyecto** manteniendo esta estructura:

```
public_html/                    (o la carpeta raíz que use tu hosting)
├── backend/
│   ├── config.php
│   ├── config.json
│   ├── helpers.php
│   ├── login.php
│   ├── logout.php
│   ├── session.php
│   ├── productos.php
│   ├── ofertas.php
│   ├── usuarios.php
│   ├── tvs.php
│   └── README.md
├── JSON/
│   ├── users.json
│   ├── productos.json
│   ├── ofertas.json
│   ├── tvs.json
│   └── .htaccess          (protege los JSON de lectura directa)
├── uploads/
│   └── ofertas/            (carpeta vacía; el backend crea archivos aquí)
└── (si tenés frontend: index2.html, promociones.html, etc.)
```

**Importante:** `backend/`, `JSON/` y `uploads/` deben estar **al mismo nivel** (todos dentro de la misma carpeta raíz). El backend usa esa estructura para encontrar los JSON y la carpeta de subidas.

---

## 3. Cómo subir el proyecto

### Opción A: Subir todo por FTP

1. Conectate por **FTP/SFTP** (FileZilla, WinSCP, o el cliente que uses) con el usuario que te dio el hosting.
2. Entrá a la carpeta raíz web (`public_html` o la que te hayan indicado).
3. Subí **todas** estas carpetas y su contenido:
   - **backend/** (todos los `.php` y `config.json`)
   - **JSON/** (todos los `.json` y el `.htaccess`)
   - **uploads/** (creá la carpeta `uploads/ofertas` si no existe; puede ir vacía)
4. Si ya tenés un sitio (por ejemplo la cartelera), podés subir el backend dentro de la misma raíz (por ejemplo `public_html/backend/`, `public_html/JSON/`, etc.).

### Opción B: Subir un ZIP y descomprimir

1. En tu PC: comprimí en un ZIP la carpeta **TVPANEL** con `backend`, `JSON` y `uploads` (y el front si lo tenés).
2. En el hosting: entrá al **Administrador de archivos** (cPanel → Administrador de archivos).
3. Entrá a la raíz web (`public_html`).
4. Subí el archivo ZIP.
5. Usá la opción **“Extraer”** / “Extract” del administrador de archivos para descomprimir.
6. Si el ZIP creó una carpeta `TVPANEL`, mové todo su contenido (backend, JSON, uploads) **dentro** de `public_html`, para que la URL quede como en el punto 4 más abajo.

---

## 4. Permisos de carpetas (escritura)

El servidor tiene que poder **escribir** en:

- **JSON/** — para que el backend pueda actualizar `users.json`, `productos.json`, `ofertas.json`, `tvs.json`.
- **uploads/ofertas/** — para guardar imágenes y videos de ofertas.

En la mayoría de hostings alcanza con:

- Carpetas: **755**
- Archivos `.json`: **644** (o **664** si 755 no alcanza para que PHP escriba)

Si después de subir ves errores tipo “Error al guardar” o “Permission denied”, subí los permisos de la carpeta `JSON` y de `uploads/ofertas` a **755** o **775** (según lo que permita tu panel). En cPanel: clic derecho sobre la carpeta → “Cambiar permisos” / “Change permissions”.

---

## 5. URLs del backend

Supongamos que tu dominio es `https://midominio.com` y subiste todo dentro de `public_html` (o que la raíz del sitio es esa carpeta).

Entonces las URLs quedarían:

| Qué          | URL |
|-------------|-----|
| Login       | `https://midominio.com/backend/login.php` |
| Logout      | `https://midominio.com/backend/logout.php` |
| Sesión      | `https://midominio.com/backend/session.php` |
| Productos   | `https://midominio.com/backend/productos.php` |
| Ofertas     | `https://midominio.com/backend/ofertas.php` |
| Usuarios    | `https://midominio.com/backend/usuarios.php` |
| TVs         | `https://midominio.com/backend/tvs.php` |

Si en vez de la raíz usaste una subcarpeta (ej. `public_html/tvpanel/`), las URLs serían:

`https://midominio.com/tvpanel/backend/login.php`, etc.

---

## 6. Configurar la ruta de los JSON (si hace falta)

Por defecto el backend busca los JSON en la carpeta **JSON** (al mismo nivel que `backend/`). Eso ya coincide con la estructura que subiste.

Si en tu hosting quisieras usar **otra** carpeta para los JSON:

1. Abrí en el servidor: `backend/config.json`.
2. Cambiá la ruta, por ejemplo:
   - `"dataPath": "JSON"`  → ya es el valor por defecto.
   - Si pusieras los JSON en `public_html/datos`, pondrías: `"dataPath": "datos"`.

No hace falta tocar ningún `.php`; solo ese archivo.

---

## 7. Probar que está conectado

1. **Login**  
   Desde el navegador o Postman:  
   `POST https://midominio.com/backend/login.php`  
   Body (formato JSON):  
   `{"usuario": "admin", "password": "1234"}`  
   (o el usuario/contraseña que tengas en `JSON/users.json`).  
   Deberías recibir algo como: `{"ok": true, "usuario": "admin", "perfil": "Admin"}`.

2. **Listar productos**  
   Después de hacer login (para que la sesión quede en la misma cookie):  
   `GET https://midominio.com/backend/productos.php?action=list`  
   Deberías recibir el contenido de `productos.json` (o la estructura con categorías).

Si eso funciona, el proyecto ya está conectado al hosting. El frontend (cartelera, panel de administración) solo tiene que usar esas mismas URLs como “base” del backend.

---

## 8. Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | Subir **backend/**, **JSON/** y **uploads/** a la raíz web del hosting. |
| 2 | Dar permisos de escritura a **JSON/** y **uploads/ofertas/** (755 o 775). |
| 3 | Usar las URLs tipo `https://tudominio.com/backend/login.php`, etc. |
| 4 | En el front, apuntar todas las llamadas al backend a esa base: `https://tudominio.com/backend/`. |

Si tu hosting usa otra raíz (por ejemplo solo una subcarpeta para este proyecto), adaptá las URLs añadiendo esa carpeta (ej. `/tvpanel/backend/login.php`). La guía anterior sigue igual en concepto; solo cambia la parte del path antes de `backend/`.
