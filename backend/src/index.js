// Day Tracker API: one Lambda, routes checked by hand.
// Data model (single table): pk=USER#<sub>  sk=DAY#<date> | CFG | BW#<date>
//                            pk=GLOBAL      sk=DEFAULTS    (shared default exercises)
//                            pk=AUDIT       sk=<iso time>#<id>  (admin actions)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, ListUsersCommand, AdminDisableUserCommand, AdminEnableUserCommand, AdminDeleteUserCommand, AdminUserGlobalSignOutCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CognitoJwtVerifier } = require('aws-jwt-verify');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cog = new CognitoIdentityProviderClient({});
const { TABLE, USER_POOL_ID, CLIENT_ID } = process.env;
const verifier = CognitoJwtVerifier.create({ userPoolId: USER_POOL_ID, tokenUse: 'id', clientId: CLIENT_ID });

const res = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const put = (pk, sk, data) => ddb.send(new PutCommand({ TableName: TABLE, Item: { pk, sk, data, updatedAt: Date.now() } }));

async function all(pk) {
  let items = [], key;
  do {
    const r = await ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': pk }, ExclusiveStartKey: key }));
    items = items.concat(r.Items);
    key = r.LastEvaluatedKey;
  } while (key);
  return items;
}

async function load(pk) {
  const out = { days: {}, cfg: null, bw: [] };
  for (const i of await all(pk)) {
    if (i.sk.startsWith('DAY#')) out.days[i.sk.slice(4)] = i.data;
    else if (i.sk === 'CFG') out.cfg = i.data;
    else if (i.sk.startsWith('BW#')) out.bw.push({ d: i.sk.slice(3), w: i.data.w });
  }
  return out;
}

async function wipe(pk) {
  const items = await all(pk);
  for (let i = 0; i < items.length; i += 25) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: items.slice(i, i + 25).map((x) => ({ DeleteRequest: { Key: { pk: x.pk, sk: x.sk } } })) } }));
  }
}

async function admin(me, method, parts, body) {
  const log = (action, target) => put('AUDIT', new Date().toISOString() + '#' + Math.random().toString(36).slice(2, 6), { by: me.email, action, target });
  const [, area, sub, action] = parts;
  if (sub && !/^[\w-]{10,64}$/.test(sub)) return res(400, { error: 'bad user id' });

  if (method === 'GET' && area === 'users' && !sub) {
    const r = await cog.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID, Limit: 60 }));
    const attr = (u, n) => (u.Attributes.find((a) => a.Name === n) || {}).Value;
    return res(200, r.Users.map((u) => ({ sub: attr(u, 'sub'), email: attr(u, 'email'), enabled: u.Enabled, created: u.UserCreateDate })));
  }
  if (area === 'users' && sub) {
    const base = { UserPoolId: USER_POOL_ID, Username: sub };
    if (method === 'GET' && action === 'data') { await log('view data', sub); return res(200, await load('USER#' + sub)); }
    if (method === 'POST' && action === 'disable' && sub !== me.sub) {
      await cog.send(new AdminDisableUserCommand(base));
      await cog.send(new AdminUserGlobalSignOutCommand(base));
      await log('disable', sub);
      return res(200, { ok: true });
    }
    if (method === 'POST' && action === 'enable') { await cog.send(new AdminEnableUserCommand(base)); await log('enable', sub); return res(200, { ok: true }); }
    if (method === 'DELETE' && !action && sub !== me.sub) { await wipe('USER#' + sub); await cog.send(new AdminDeleteUserCommand(base)); await log('delete', sub); return res(200, { ok: true }); }
  }
  if (method === 'PUT' && area === 'defaults' && body.lib && typeof body.lib === 'object') { await put('GLOBAL', 'DEFAULTS', body); await log('update defaults', '-'); return res(200, { ok: true }); }
  if (method === 'GET' && area === 'audit') {
    const r = await ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': 'AUDIT' }, ScanIndexForward: false, Limit: 50 }));
    return res(200, r.Items.map((i) => ({ at: i.sk.split('#')[0], ...i.data })));
  }
  return res(404, { error: 'not found' });
}

exports.handler = async (event) => {
  try {
    const method = event.requestContext.http.method;
    const parts = event.rawPath.split('/').filter(Boolean);
    const token = (event.headers.authorization || '').replace(/^Bearer /i, '');
    let claims;
    try { claims = await verifier.verify(token); } catch { return res(401, { error: 'unauthorized' }); }
    const me = { sub: claims.sub, email: claims.email, admin: (claims['cognito:groups'] || []).includes('admin') };

    let body = {};
    if (event.body) body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body);
    if (JSON.stringify(body).length > 300000) return res(413, { error: 'too large' });

    if (parts[0] === 'admin') return me.admin ? await admin(me, method, parts, body) : res(403, { error: 'forbidden' });

    // Regular users: the user id always comes from the verified token, never from the request.
    const pk = 'USER#' + me.sub;
    switch (method + ' /' + parts[0]) {
      case 'GET /me': return res(200, { sub: me.sub, email: me.email, role: me.admin ? 'admin' : 'user' });
      case 'GET /data': return res(200, await load(pk));
      case 'GET /defaults': {
        const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: 'GLOBAL', sk: 'DEFAULTS' } }));
        return res(200, r.Item ? r.Item.data : null);
      }
      case 'PUT /day':
        if (DATE.test(parts[1] || '') && Array.isArray(body.items) && Array.isArray(body.gym)) { await put(pk, 'DAY#' + parts[1], body); return res(200, { ok: true }); }
        break;
      case 'PUT /config':
        if (body.lib && typeof body.lib === 'object') { await put(pk, 'CFG', body); return res(200, { ok: true }); }
        break;
      case 'PUT /bw':
        if (DATE.test(parts[1] || '') && typeof body.w === 'number' && body.w > 0 && body.w < 500) { await put(pk, 'BW#' + parts[1], { w: body.w }); return res(200, { ok: true }); }
        break;
      default: return res(404, { error: 'not found' });
    }
    return res(400, { error: 'invalid request' });
  } catch (err) {
    console.error(err);
    return res(err instanceof SyntaxError ? 400 : 500, { error: 'error' });
  }
};
