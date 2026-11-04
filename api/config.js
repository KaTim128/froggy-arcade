
/**
 * THE GAME SETTINGS SERVER
 *
 * A Vercel serverless function, deployed with the site.
 *
 * Every player's game requests the LIVE settings when it starts
 * and periodically afterwards.
 *
 * Only the admin can publish changes.
 *
 * ADMIN PASSWORD: addmen128
 *
 * GET  /api/config
 *      Returns the current live settings.
 *
 * POST /api/config
 *      action: 'publish'
 *      password: 'addmen128'
 *      base: current live version
 *      values: { 'game.setting': value | null }
 *
 * POST /api/config
 *      action: 'restore'
 *      password: 'addmen128'
 *      gameId: game identifier
 *
 * STORAGE:
 * Redis database through its REST API.
 *
 * Configure these Vercel environment variables:
 * KV_REST_API_URL
 * KV_REST_API_TOKEN
 *
 * Alternatively:
 * UPSTASH_REDIS_REST_URL
 * UPSTASH_REDIS_REST_TOKEN
 */

const URL_ =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  '';

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  '';

const ADMIN_PASSWORD = 'addmen128';

const LIVE_KEY = 'froggy:config:live';
const LOG_KEY = 'froggy:config:log';

const KEY_RE = /^[a-z0-9]+\.[a-zA-Z0-9]+$/;
const ID_RE = /^[a-z0-9]+$/;
const VALUE_RE = /^[a-z0-9_-]{1,40}$/;


/**
 * Redis REST API connection
 */
async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });

  const j = await r.json();

  if (j.error) {
    throw new Error(j.error);
  }

  return j.result;
}


/**
 * Default live configuration
 */
const empty = () => ({
  version: 0,
  values: {},
  at: 0,
});


/**
 * Read currently published settings
 */
async function readLive() {
  const raw = await redis(['GET', LIVE_KEY]);

  if (!raw) {
    return empty();
  }

  try {
    const j = JSON.parse(raw);

    return {
      version: Number(j.version) || 0,
      values:
        j.values && typeof j.values === 'object'
          ? j.values
          : {},
      at: Number(j.at) || 0,
    };
  } catch {
    return empty();
  }
}


/**
 * Direct admin password verification
 */
function passwordOk(pw) {
  return (
    typeof pw === 'string' &&
    pw === ADMIN_PASSWORD
  );
}


/**
 * Validate setting values
 *
 * Supports:
 * Numbers within the permitted range.
 * Short plain text values.
 * Null to restore a setting to its default.
 */
function cleanValue(v) {
  if (v === null) {
    return null;
  }

  if (typeof v === 'number') {
    return Number.isFinite(v) &&
      Math.abs(v) <= 100000
      ? v
      : undefined;
  }

  if (typeof v === 'string') {
    return VALUE_RE.test(v)
      ? v
      : undefined;
  }

  return undefined;
}


/**
 * Main API handler
 */
export default async function handler(req, res) {

  // Allow the game to communicate from other domains,
  // including the GitHub Pages version.

  res.setHeader('Access-Control-Allow-Origin', '*');

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  res.setHeader('Cache-Control', 'no-store');


  // Handle browser preflight requests.

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }


  // Redis configuration is required.

  if (!URL_ || !TOKEN) {
    return res.status(503).json({
      ok: false,
      msg: 'SETTINGS SERVER NOT SET UP.',
    });
  }


  try {

    /**
     * GET
     * Retrieve live settings for all players.
     */

    if (req.method === 'GET') {

      return res.status(200).json({
        ok: true,
        live: await readLive(),
      });

    }


    /**
     * Only GET and POST are allowed.
     */

    if (req.method !== 'POST') {

      return res.status(405).json({
        ok: false,
        msg: 'NOT ALLOWED.',
      });

    }


    /**
     * Read request body.
     */

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};


    /**
     * Password attempt protection.
     *
     * Maximum 20 attempts per IP within 10 minutes.
     */

    const ip = String(
      req.headers['x-forwarded-for'] || 'x'
    )
      .split(',')[0]
      .trim();

    const tries = await redis([
      'INCR',
      `froggy:config:tries:${ip}`,
    ]);

    if (tries === 1) {
      await redis([
        'EXPIRE',
        `froggy:config:tries:${ip}`,
        600,
      ]);
    }

    if (tries > 20) {

      return res.status(429).json({
        ok: false,
        msg: 'TOO MANY TRIES. WAIT A FEW MINUTES.',
      });

    }


    /**
     * Verify admin password.
     */

    if (!passwordOk(body.password)) {

      return res.status(401).json({
        ok: false,
        msg: 'WRONG ADMIN PASSWORD.',
      });

    }


    // Reset failed attempt counter after successful login.

    await redis([
      'DEL',
      `froggy:config:tries:${ip}`,
    ]);


    /**
     * Retrieve current live settings.
     */

    const live = await readLive();


    /**
     * PUBLISH
     *
     * Publish settings globally.
     * All players and devices receive the new settings
     * when their games fetch the live configuration.
     */

    if (body.action === 'publish') {

      // Prevent publishing over a newer configuration.

      if (Number(body.base) !== live.version) {

        return res.status(409).json({
          ok: false,
          msg: 'LIVE CHANGED SINCE THIS TEST BEGAN. RESET THE TEST AND TRY AGAIN.',
          live,
        });

      }


      const values =
        body.values &&
        typeof body.values === 'object' &&
        !Array.isArray(body.values)
          ? body.values
          : {};

      const keys = Object.keys(values);


      if (!keys.length || keys.length > 300) {

        return res.status(400).json({
          ok: false,
          msg: 'NOTHING TO PUBLISH.',
        });

      }


      // Preserve existing settings.

      const next = {
        ...live.values,
      };


      // Validate and apply each setting.

      for (const k of keys) {

        const v = cleanValue(values[k]);

        if (!KEY_RE.test(k) || v === undefined) {

          return res.status(400).json({
            ok: false,
            msg: `BAD SETTING ${k}.`,
          });

        }


        // Null removes the setting and returns it to default.

        if (v === null) {
          delete next[k];
        } else {
          next[k] = v;
        }

      }


      // Increment global configuration version.

      const out = {
        version: live.version + 1,
        values: next,
        at: Date.now(),
      };


      // Save globally to Redis.

      await redis([
        'SET',
        LIVE_KEY,
        JSON.stringify(out),
      ]);


      // Record publishing history.

      await redis([
        'LPUSH',
        LOG_KEY,
        JSON.stringify({
          at: out.at,
          what: `PUBLISHED ${keys.length}: ${keys.join(', ')}`,
        }),
      ]);

      await redis([
        'LTRIM',
        LOG_KEY,
        0,
        49,
      ]);


      return res.status(200).json({
        ok: true,
        live: out,
      });

    }


    /**
     * RESTORE
     *
     * Restore one game's settings to its original defaults.
     */

    if (body.action === 'restore') {

      const id = String(body.gameId || '');


      if (!ID_RE.test(id)) {

        return res.status(400).json({
          ok: false,
          msg: 'NO SUCH GAME.',
        });

      }


      const next = {
        ...live.values,
      };

      let n = 0;


      // Remove all settings belonging to this game.

      for (const k of Object.keys(next)) {

        if (k.startsWith(`${id}.`)) {

          delete next[k];
          n++;

        }

      }


      // No changes required.

      if (!n) {

        return res.status(200).json({
          ok: false,
          msg: 'ALREADY ON ITS DEFAULTS.',
          live,
        });

      }


      // Create new global version.

      const out = {
        version: live.version + 1,
        values: next,
        at: Date.now(),
      };


      // Save restored settings globally.

      await redis([
        'SET',
        LIVE_KEY,
        JSON.stringify(out),
      ]);


      // Record restoration history.

      await redis([
        'LPUSH',
        LOG_KEY,
        JSON.stringify({
          at: out.at,
          what: `RESTORED DEFAULTS: ${id}`,
        }),
      ]);

      await redis([
        'LTRIM',
        LOG_KEY,
        0,
        49,
      ]);


      return res.status(200).json({
        ok: true,
        live: out,
      });

    }


    /**
     * Unknown action.
     */

    return res.status(400).json({
      ok: false,
      msg: 'UNKNOWN ACTION.',
    });


  } catch (e) {

    /**
     * Server error handling.
     */

    return res.status(500).json({
      ok: false,
      msg: 'SETTINGS SERVER ERROR.',
      detail: String(
        e && e.message ? e.message : e
      ),
    });

  }

}
