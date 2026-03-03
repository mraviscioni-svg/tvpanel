<?php
/**
 * ABM Usuarios - graba en JSON/users.json
 * Estructura: { updated, users: [ { id, username, password, name, role, active } ] }
 * role: admin | editor. Solo Admin puede gestionar usuarios.
 */
require_once __DIR__ . '/helpers.php';

requireAdmin();

$input = getInput();
$action = $_GET['action'] ?? $input['action'] ?? 'list';
$id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($input['id']) ? (int)$input['id'] : 0);

$data = readJson(FILE_USERS);
if (!isset($data['users']) || !is_array($data['users'])) {
    $data = ['updated' => updatedTimestamp(), 'users' => []];
}
$items = &$data['users'];
$roles = ['admin', 'editor'];

switch ($action) {
    case 'list':
        $list = array_map(function ($u) {
            $c = $u;
            unset($c['password']);
            return $c;
        }, $items);
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
        unset($item['password']);
        jsonResponse(['ok' => true, 'data' => $item]);
        break;

    case 'create':
        $username = trim($input['username'] ?? $input['usuario'] ?? '');
        $password = $input['password'] ?? '';
        $name = trim($input['name'] ?? '');
        $role = strtolower(trim($input['role'] ?? 'editor'));
        if ($username === '') {
            jsonError('Usuario (username) requerido');
        }
        if (!in_array($role, $roles, true)) {
            jsonError('Role debe ser admin o editor');
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
        if (isset($input['username'])) {
            $items[$idx]['username'] = trim($input['username']);
        }
        if (isset($input['name'])) {
            $items[$idx]['name'] = trim($input['name']);
        }
        if (isset($input['role']) && in_array(strtolower(trim($input['role'])), $roles, true)) {
            $items[$idx]['role'] = strtolower(trim($input['role']));
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
