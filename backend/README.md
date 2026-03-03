# Backend TVPANEL (PHP)

Backend para administrar listado de productos, ofertas, usuarios y televisores. Pensado para **hosting con PHP** (sin base de datos; todo en JSON).

## Ruta de los JSON (configurable)

Los JSON se leen desde una carpeta **a la misma altura que `backend/`**. Por defecto es **`JSON`** (es decir: `TVPANEL/JSON/productos.json`, etc.).

Para cambiar la carpeta, editá **`backend/config.json`**:

```json
{
    "dataPath": "JSON"
}
```

Podés poner otra ruta relativa a la raíz del proyecto (ej. `"dataPath": "data"` para usar `TVPANEL/data/`).

## Estructura

- **JSON/** (o la carpeta que definas en `config.json`) — users.json, productos.json, ofertas.json, tvs.json (misma altura que `backend/`)
- **IMG/CORTES/** — Imágenes de promociones
- **IMG/CORTES/VIDEO/** — Videos de promociones
- **backend/** — Scripts PHP de la API y `config.json`

## Requisitos

- PHP 7.4+ (con `json`, `session`, `fileinfo`)
- Hosting con soporte para sesiones y escritura en disco

## Despliegue en hosting

1. Subí toda la carpeta del proyecto (o al menos `backend/`, `JSON/`, `IMG/`).
2. La **raíz web** debe apuntar a la carpeta del proyecto (ej. TEST). Ejemplo: si el sitio es **https://tvpanel.tallerboedo.com.ar/** y esa raíz es la carpeta TEST, el backend se accede en **https://tvpanel.tallerboedo.com.ar/backend/**.
3. Permisos de escritura: `JSON/` e `IMG/CORTES/` (y `IMG/CORTES/VIDEO/`) deben ser escribibles por PHP (chmod 755 o 775).

## Estructura de los JSON (referencia)

- **users.json**: `{ "updated": "...", "users": [ { "id", "username", "password", "name", "role": "admin"|"editor", "active": 1 } ] }`
- **productos.json**: `{ "updated", "moneda": "ARS", "categorias": [ { "nombre", "items": [ { "id", "nombre", "unidad", "precio", "tag", "estado" } ] } ] }`
- **ofertas.json**: `{ "updated", "moneda", "categorias": [ { "nombre", "items": [ { "id"?, "nombre", "unidad", "precio", "imagen1", "imagen2" } ] } ] }` (los ítems nuevos reciben `id` al crear)
- **tvs.json**: `{ "header": { "title", "hint" }, "tvs": [ { "id", "title", "tag", "description", "url", "active" } ] }`

## Usuarios (login)

El login usa **username** y **password** de `users.json`. Roles: **admin** (acceso total) y **editor** (Usuario). Cambiá las contraseñas en producción desde ABM Usuarios (solo admin).

## Endpoints (API)

Base: **https://tvpanel.tallerboedo.com.ar/backend/** (raíz del sitio = TEST).

**Panel de administración (ABM):** **https://tvpanel.tallerboedo.com.ar/admin/**

### Auth

| Método | URL        | Body / Params     | Descripción      |
|--------|------------|-------------------|------------------|
| POST   | login.php  | `usuario`, `password` | Login (devuelve ok, usuario, perfil) |
| GET/POST | logout.php | —                 | Cerrar sesión    |
| GET    | session.php| —                 | Ver si hay sesión (usuario, perfil)  |

### Productos (requiere login)

| Acción | Cómo llamar | Body / Params |
|--------|-------------|----------------|
| Listar | GET productos.php?action=list | — |
| Ver uno | GET productos.php?action=get&id=1 | — |
| Crear | POST productos.php | action=create, nombre, precio, descripcion, categoria, activo |
| Actualizar | POST productos.php | action=update, id, nombre, precio, descripcion, categoria, activo |
| Eliminar | POST productos.php | action=delete, id |

### Ofertas (requiere login, con imagen/video)

| Acción | Cómo llamar | Body / Params / Files |
|--------|-------------|------------------------|
| Listar | GET ofertas.php?action=list | — |
| Ver una | GET ofertas.php?action=get&id=1 | — |
| Crear | POST ofertas.php (multipart) | action=create, titulo, descripcion, fecha_desde, fecha_hasta, activo; archivos: imagen, video |
| Actualizar | POST ofertas.php (multipart) | action=update, id, titulo, ...; opcional: imagen, video |
| Eliminar | POST ofertas.php | action=delete, id |

Formatos aceptados: imagen → jpg, png, gif, webp; video → mp4, webm, mov.

### Usuarios (solo Admin)

| Acción | Cómo llamar | Body / Params |
|--------|-------------|----------------|
| Listar | GET usuarios.php?action=list | — |
| Ver uno | GET usuarios.php?action=get&id=1 | — |
| Crear | POST usuarios.php | action=create, usuario, password, perfil (Admin/Usuario) |
| Actualizar | POST usuarios.php | action=update, id, usuario, perfil, password (opcional) |
| Eliminar | POST usuarios.php | action=delete, id |

### Televisores (requiere login)

| Acción | Cómo llamar | Body / Params |
|--------|-------------|----------------|
| Listar | GET tvs.php?action=list | — |
| Ver uno | GET tvs.php?action=get&id=1 | — |
| Crear | POST tvs.php | action=create, nombre, ubicacion, codigo, activo |
| Actualizar | POST tvs.php | action=update, id, nombre, ubicacion, codigo, activo |
| Eliminar | POST tvs.php | action=delete, id |

## Sesiones

El login usa sesiones PHP (`$_SESSION`). Las cookies de sesión deben permitirse desde el front (mismo dominio o CORS según cómo esté configurado el hosting). Si el front está en otro dominio, puede que tengas que configurar sesión/cookie o usar otro mecanismo (token) en el futuro.

## Rutas en el servidor

Si en el hosting la raíz web es la carpeta del proyecto:

- API: `https://tudominio.com/backend/login.php`, `.../backend/productos.php`, etc.
- Subidas de ofertas: se guardan en `uploads/ofertas/`. Para mostrarlas: `https://tudominio.com/uploads/ofertas/nombre_archivo.jpg`.

Si la raíz web es directamente la carpeta `backend/`, entonces `config.php` debe usar la ruta al padre para `DATA_DIR` y `UPLOADS_DIR`; actualmente asume que el proyecto está una carpeta arriba de `backend/` (estructura actual: TVPANEL/backend/, TVPANEL/data/, TVPANEL/uploads/).
