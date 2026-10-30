// docker/mock-server/server.mjs
// Serveur Mock Supabase ultra-léger (Node.js natif sans dépendances externes)
import http from 'node:http';

const PORT = 8000;

const mockUser = {
  id: '00000000-0000-4000-a000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'alex@fitcouple.local',
  created_at: '2026-01-01T08:00:00Z',
  user_metadata: { display_name: 'Alex' },
};

const mockSession = {
  access_token: 'mock-jwt-token-alex',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  user: mockUser,
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  // 1. Healthcheck
  if (path === '/health' || path === '/status') {
    return sendJson(res, 200, { status: 'ok', mock: 'supabase-node-alpine' });
  }

  // 2. Auth Endpoints (/auth/v1/*)
  if (path.startsWith('/auth/v1/token')) {
    return sendJson(res, 200, mockSession);
  }
  if (path === '/auth/v1/user') {
    return sendJson(res, 200, mockUser);
  }
  if (path === '/auth/v1/logout') {
    return sendJson(res, 200, {});
  }

  // 3. PostgREST REST API (/rest/v1/*)
  if (path.startsWith('/rest/v1/profiles')) {
    return sendJson(res, 200, [
      {
        id: mockUser.id,
        display_name: 'Alex',
        partner_id: '00000000-0000-4000-a000-000000000002',
        calorie_target: 2400,
        protein_target_g: 170,
        carbs_target_g: 260,
        fat_target_g: 75,
      },
    ]);
  }

  if (path.startsWith('/rest/v1/daily_logs')) {
    return sendJson(res, 200, [
      {
        id: 'log-01',
        user_id: mockUser.id,
        log_date: '2026-10-30',
        weight_kg: 81.2,
        weight_ema_kg: 81.5,
        exclude_from_tdee: false,
        energy_rating: 5,
        daily_note: 'Pleine forme',
      },
    ]);
  }

  if (path.startsWith('/rest/v1/exercises')) {
    return sendJson(res, 200, [
      {
        id: 'ex-01',
        name: 'Développé couché barre',
        muscle_group: 'Pecs',
        default_rest_seconds: 120,
        is_custom: false,
      },
      {
        id: 'ex-02',
        name: 'Squat barre nuque',
        muscle_group: 'Quadriceps',
        default_rest_seconds: 150,
        is_custom: false,
      },
    ]);
  }

  if (path.startsWith('/rest/v1/foods')) {
    return sendJson(res, 200, [
      {
        id: 'food-01',
        name: 'Flocons d avoine bio',
        allowed_unit: '100g',
        calories_per_100g: 375,
        protein_per_100g: 13.5,
        carbs_per_100g: 62.0,
        fat_per_100g: 7.0,
      },
    ]);
  }

  if (path.startsWith('/rest/v1/rpc/')) {
    return sendJson(res, 200, { status: 'ok', partner_id: 'mock-partner-id' });
  }

  // Fallback générique pour toute insertion ou requête REST mockée
  if (path.startsWith('/rest/v1/')) {
    if (req.method === 'POST') {
      return sendJson(res, 201, [{ id: 'mock-created-id', status: 'created' }]);
    }
    return sendJson(res, 200, []);
  }

  return sendJson(res, 404, { error: 'Not found on mock server' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Mock Supabase] running on http://0.0.0.0:${PORT}`);
});

