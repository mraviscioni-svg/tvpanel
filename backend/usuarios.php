<?php
/**
 * ABM Usuarios - graba en JSON/users.json
 * Estructura: { updated, users: [ { id, username, password, name, role, active } ] }
 * role: admin | supervisor | editor. Admin: todo. Supervisor: solo altas/edición de editores.
 */
require_once __DIR__ . '/helpers.php';

$user = requireAdminOrSupervisor();

$input = getInput();
$action = $_GET['action'] ?? $input['action'] ?? 'list';
$id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($input['id']) ? (int)$input['id'] : 0);

$data = readJson(FILE_USERS);
if (!isset($data['users']) || !is_array($data['users'])) {
    $data = ['updated' => updatedTimestamp(), 'users' => []];
}
$items = &$data['users'];
$roles = ['admin', 'supervisor', 'editor'];

function getRole($u) {
    return strtolower(trim($u['role'] ?? $u['usuario'] ?? 'editor'));
}

switch ($action) {
    case 'list':
        $list = array_map(function ($u) {
            $c = $u;
            unset($c['password']);
            return $c;
        }, $items);
        if ($user['perfil'] === PERFIL_SUPERVISOR) {
            $sessionId = (int)($_SESSION['user_id'] ?? 0);
            $list = array_values(array_filter($list, function ($u) use ($sessionId) {
                return (int)($u['created_by_id'] ?? 0) === $sessionId;
            }));
        }
        jsonResponse(['ok' => true, 'data' => $list]);
        break;

    case 'get':
        $item = null;
        foreach ($items as $u) {
            if (isset($u['id']) && (int)$u['id'] === $id) {
                $item = $u;
                break;
            }
        }
        if (!$item) {
            jsonError('Usuario no encontrado', 404);
        }
        if ($user['perfil'] === PERFIL_SUPERVISOR) {
            $sessionId = (int)($_SESSION['user_id'] ?? 0);
            if ((int)($item['created_by_id'] ?? 0) !== $sessionId) {
                jsonError('Usuario no encontrado', 404);
            }
        }
        unset($item['password']);
        jsonResponse(['ok' => true, 'data' => $item]);
        break;

    case 'create':
        $username = trim($input['username'] ?? $input['usuario'] ?? '');
        $password = $input['password'] ?? '';
        $name = trim($input['name'] ?? '');
        $role = strtolower(trim($input['role'] ?? 'editor'));
        if ($user['perfil'] === PERFIL_SUPERVISOR) {
            $role = 'editor';
        }
        if ($username === '') {
            jsonError('Usuario (username) requerido');
        }
        if (!in_array($role, $roles, true)) {
            jsonError('Role debe ser admin, supervisor o editor');
        }
        foreach ($items as $u) {
            $un = $u['username'] ?? $u['usuario'] ?? '';
            if (strcasecmp($un, $username) === 0) {
                jsonError('Ya existe un usuario con ese nombre');
            }
        }
        $newId = nextId($items);
        $new = [
            'id' => $newId,
            'username' => $username,
            'password' => $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : password_hash($username . '123', PASSWORD_DEFAULT),
            'name' => $name,
            'role' => $role,
            'active' => 1,
        ];
        if ($user['perfil'] === PERFIL_SUPERVISOR) {
            $new['created_by_id'] = (int)($_SESSION['user_id'] ?? 0);
        }
        $items[] = $new;
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_USERS, $data)) {
            jsonError('Error al guardar', 500);
        }
        unset($new['password']);
        jsonResponse(['ok' => true, 'data' => $new]);
        break;

    case 'update':
        $idx = null;
        foreach ($items as $i => $u) {
            if (isset($u['id']) && (int)$u['id'] === $id) {
                $idx = $i;
                break;
            }
        }
        if ($idx === null) {
            jsonError('Usuario no encontrado', 404);
        }
        if ($user['perfil'] === PERFIL_SUPERVISOR) {
            if (getRole($items[$idx]) !== 'editor') {
                jsonError('Solo puede editar usuarios con rol editor', 403);
            }
            $sessionId = (int)($_SESSION['user_id'] ?? 0);
            if ((int)($items[$idx]['created_by_id'] ?? 0) !== $sessionId) {
                jsonError('Solo puede editar usuarios creados por usted', 403);
            }
        }
        if (isset($input['username'])) {
            $items[$idx]['username'] = trim($input['username']);
        }
        if (isset($input['name'])) {
            $items[$idx]['name'] = trim($input['name']);
        }
        if (isset($input['role']) && in_array(strtolower(trim($input['role'])), $roles, true)) {
            if ($user['perfil'] === PERFIL_SUPERVISOR) {
                $items[$idx]['role'] = 'editor';
            } else {
                $items[$idx]['role'] = strtolower(trim($input['role']));
            }
        }
        if (isset($input['active'])) {
            $items[$idx]['active'] = (int)(bool)$input['active'];
        }
        if (isset($input['password']) && $input['password'] !== '') {
            $items[$idx]['password'] = password_hash($input['password'], PASSWORD_DEFAULT);
        }
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_USERS, $data)) {
            jsonError('Error al guardar', 500);
        }
        $out = $items[$idx];
        unset($out['password']);
        jsonResponse(['ok' => true, 'data' => $out]);
        break;

    case 'delete':
        $idx = null;
        foreach ($items as $i => $u) {
            if (isset($u['id']) && (int)$u['id'] === $id) {
                $idx = $i;
                break;
            }
        }
        if ($idx === null) {
            jsonError('Usuario no encontrado', 404);
        }
        $currentUser = $items[$idx]['username'] ?? $items[$idx]['usuario'] ?? '';
        if ($currentUser === $_SESSION['usuario']) {
            jsonError('No puede eliminarse a sí mismo');
        }
        if ($user['perfil'] === PERFIL_SUPERVISOR) {
            if (getRole($items[$idx]) !== 'editor') {
                jsonError('Solo puede eliminar usuarios con rol editor', 403);
            }
            $sessionId = (int)($_SESSION['user_id'] ?? 0);
            if ((int)($items[$idx]['created_by_id'] ?? 0) !== $sessionId) {
                jsonError('Solo puede eliminar usuarios creados por usted', 403);
            }
        }
        array_splice($items, $idx, 1);
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_USERS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true]);
        break;

    default:
        jsonError('Acción no válida');
}
