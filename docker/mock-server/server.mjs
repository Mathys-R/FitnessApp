// docker/mock-server/server.mjs
// Moteur PostgREST en mémoire vive simulant l'ensemble des tables Supabase
import http from 'node:http';
import crypto from 'node:crypto';
import { DB, mockUser, partnerUser, getTodayIso } from './db.mjs';

const PORT = 8000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}

function matchItem(item, searchParams) {
  for (const [key, rawVal] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    const itemVal = item[key];
    if (rawVal.startsWith('eq.')) {
      if (String(itemVal) !== rawVal.slice(3)) return false;
    } else if (rawVal.startsWith('gte.')) {
      if (itemVal < rawVal.slice(4)) return false;
    } else if (rawVal.startsWith('lte.')) {
      if (itemVal > rawVal.slice(4)) return false;
    } else if (rawVal === 'is.null') {
      if (itemVal !== null && itemVal !== undefined) return false;
    } else if (rawVal === 'not.is.null') {
      if (itemVal === null || itemVal === undefined) return false;
    }
  }
  return true;
}

function expandRelations(table, item) {
  const clone = { ...item };
  if (table === 'workout_presets') {
    clone.workout_preset_exercises = (DB.workout_preset_exercises || [])
      .filter((pe) => pe.preset_id === item.id)
      .map((pe) => ({ ...pe, exercise: (DB.exercises || []).find((e) => e.id === pe.exercise_id) || null }));
  } else if (table === 'recipes') {
    clone.recipe_ingredients = (DB.recipe_ingredients || [])
      .filter((ri) => ri.recipe_id === item.id)
      .map((ri) => ({ ...ri, food: (DB.foods || []).find((f) => f.id === ri.food_id) || null }));
  } else if (table === 'meal_entries') {
    clone.food = (DB.foods || []).find((f) => f.id === item.food_id) || null;
    clone.meal_entry_items = (DB.meal_entry_items || [])
      .filter((mi) => mi.meal_entry_id === item.id)
      .map((mi) => ({ ...mi, food: (DB.foods || []).find((f) => f.id === mi.food_id) || null }));
  } else if (table === 'workout_sessions') {
    clone.workout_session_exercises = (DB.workout_session_exercises || [])
      .filter((se) => se.session_id === item.id)
      .map((se) => ({
        ...se,
        exercise: (DB.exercises || []).find((e) => e.id === se.exercise_id) || null,
        workout_sets: (DB.workout_sets || []).filter((s) => s.session_exercise_id === se.id),
      }));
  }
  return clone;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const isSingle = (req.headers.accept || '').includes('vnd.pgrst.object+json');

  if (path === '/health' || path === '/status') return sendJson(res, 200, { status: 'ok', mock: 'supabase-in-memory' });
  if (path.startsWith('/auth/v1/token')) return sendJson(res, 200, { access_token: 'mock-jwt-alex', token_type: 'bearer', expires_in: 3600, user: mockUser });
  if (path === '/auth/v1/user') return sendJson(res, 200, mockUser);
  if (path === '/auth/v1/logout') return sendJson(res, 200, {});

  // RPCs
  if (path.startsWith('/rest/v1/rpc/get_partner_info')) {
    return sendJson(res, 200, [{ partner_id: partnerUser.id, partner_name: partnerUser.display_name }]);
  }
  if (path.startsWith('/rest/v1/rpc/copy_meal_entries')) {
    const params = await readBody(req);
    const sourceEntries = (DB.meal_entries || []).filter((e) => e.meal_type === params.p_source_meal_type);
    for (const src of sourceEntries) {
      const newId = crypto.randomUUID();
      DB.meal_entries.push({ ...src, id: newId, daily_log_id: params.p_target_daily_log_id, meal_type: params.p_target_meal_type, user_id: mockUser.id });
    }
    return sendJson(res, 200, sourceEntries.length);
  }

  // REST API
  const tableName = path.replace('/rest/v1/', '').split('/')[0];
  if (!DB[tableName]) DB[tableName] = [];
  const tableData = DB[tableName];

  if (req.method === 'GET') {
    let results = tableData.filter((item) => matchItem(item, url.searchParams));
    const order = url.searchParams.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      results.sort((a, b) => (dir === 'desc' ? (b[col] > a[col] ? 1 : -1) : (a[col] > b[col] ? 1 : -1)));
    }
    const limit = url.searchParams.get('limit');
    if (limit) results = results.slice(0, parseInt(limit, 10));
    results = results.map((item) => expandRelations(tableName, item));
    return sendJson(res, 200, isSingle ? (results[0] || null) : results);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const rows = (Array.isArray(body) ? body : [body]).map((r) => {
      const item = { ...r, id: r.id || crypto.randomUUID(), created_at: r.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
      // Déduplication / upsert spécial pour daily_logs et user_exercise_notes
      if (tableName === 'daily_logs') {
        const idx = tableData.findIndex((l) => l.user_id === item.user_id && l.log_date === item.log_date);
        if (idx >= 0) { Object.assign(tableData[idx], item); return tableData[idx]; }
      } else if (tableName === 'user_exercise_notes') {
        const idx = tableData.findIndex((n) => n.user_id === item.user_id && n.exercise_id === item.exercise_id);
        if (idx >= 0) { Object.assign(tableData[idx], item); return tableData[idx]; }
      }
      tableData.push(item);
      return item;
    });
    return sendJson(res, 201, isSingle ? rows[0] : rows);
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = await readBody(req);
    const updated = [];
    tableData.forEach((item) => {
      if (matchItem(item, url.searchParams)) {
        Object.assign(item, body, { updated_at: new Date().toISOString() });
        updated.push(item);
        if (tableName === 'profiles') {
          const today = getTodayIso();
          const todayLog = DB.daily_logs.find((l) => l.log_date === today);
          if (todayLog) {
            if (body.current_target_kcal !== undefined) todayLog.target_kcal = body.current_target_kcal;
            if (body.current_target_p !== undefined) todayLog.target_p = body.current_target_p;
            if (body.current_target_g !== undefined) todayLog.target_g = body.current_target_g;
            if (body.current_target_l !== undefined) todayLog.target_l = body.current_target_l;
          }
        }
      }
    });
    return sendJson(res, 200, isSingle ? (updated[0] || null) : updated);
  }

  if (req.method === 'DELETE') {
    const toKeep = [];
    tableData.forEach((item) => {
      if (matchItem(item, url.searchParams)) {
        // Cascade delete
        if (tableName === 'workout_presets') DB.workout_preset_exercises = (DB.workout_preset_exercises || []).filter((e) => e.preset_id !== item.id);
        if (tableName === 'recipes') DB.recipe_ingredients = (DB.recipe_ingredients || []).filter((ri) => ri.recipe_id !== item.id);
        if (tableName === 'meal_entries') DB.meal_entry_items = (DB.meal_entry_items || []).filter((mi) => mi.meal_entry_id !== item.id);
      } else {
        toKeep.push(item);
      }
    });
    DB[tableName] = toKeep;
    return sendJson(res, 200, []);
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`[Mock Supabase In-Memory] listening on port ${PORT}`));
