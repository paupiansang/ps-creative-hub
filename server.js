require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Stripe = require('stripe');
const db = require('./db');
const {
  signUser,
  hashPassword,
  comparePassword,
  requireAuth,
  requireAdmin,
  verifyToken
} = require('./auth');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const publicDir = path.join(__dirname, 'public');

const assetDir = path.resolve(
  process.env.UPLOAD_DIR ||
  path.join(__dirname, 'storage', 'assets')
);

const mediaDir = path.resolve(
  process.env.MEDIA_DIR ||
  path.join(publicDir, 'uploads', 'media')
);

const proofDir = path.resolve(
  process.env.PROOF_DIR ||
  path.join(publicDir, 'uploads', 'proofs')
);

fs.mkdirSync(assetDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(proofDir, { recursive: true });

const stripe =
  process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

// --------------------------------------------------
// FILE UPLOAD STORAGE
// --------------------------------------------------

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(
      null,
      file.fieldname === 'file'
        ? assetDir
        : mediaDir
    );
  },

  filename: (_req, file, cb) => {
    const safe = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]+/g, '_');

    cb(
      null,
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${safe}`
    );
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024
  }
});

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) =>
      cb(null, proofDir),

    filename: (_req, file, cb) => {
      const safe = path
        .basename(file.originalname)
        .replace(/[^a-zA-Z0-9._-]+/g, '_');

      cb(
        null,
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safe}`
      );
    }
  }),

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    cb(
      null,
      /^image\/(png|jpe?g|webp)$/i.test(
        file.mimetype
      )
    );
  }
});

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(cookieParser());

app.use(
  express.json({
    limit: '4mb'
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

// --------------------------------------------------
// LEGACY STRIPE WEBHOOK
// --------------------------------------------------
// Kept for compatibility with existing historical
// product purchase records.
// New Premium access uses manual KBZ Pay membership.
// --------------------------------------------------

app.post(
  '/api/stripe/webhook',
  express.raw({
    type: 'application/json'
  }),
  async (req, res) => {
    if (
      !stripe ||
      !process.env.STRIPE_WEBHOOK_SECRET
    ) {
      return res
        .status(503)
        .send('Stripe webhook not configured');
    }

    try {
      const event =
        stripe.webhooks.constructEvent(
          req.body,
          req.headers['stripe-signature'],
          process.env.STRIPE_WEBHOOK_SECRET
        );

      if (
        event.type ===
        'checkout.session.completed'
      ) {
        const session =
          event.data.object;

        const userId = Number(
          session.metadata?.userId
        );

        const productId = Number(
          session.metadata?.productId
        );

        if (userId && productId) {
          db.prepare(`
            INSERT OR IGNORE INTO purchases(
              user_id,
              product_id,
              stripe_session_id,
              amount_cents,
              status
            )
            VALUES(?,?,?,?, 'paid')
          `).run(
            userId,
            productId,
            session.id,
            session.amount_total || 0
          );
        }
      }

      res.json({
        received: true
      });

    } catch (err) {
      res
        .status(400)
        .send(
          `Webhook Error: ${err.message}`
        );
    }
  }
);

// --------------------------------------------------
// STATIC FILES
// --------------------------------------------------

app.use(
  express.static(publicDir)
);

// Explicit admin routes
app.get('/admin', (_req, res) =>
  res.sendFile(
    path.join(
      publicDir,
      'admin.html'
    )
  )
);

app.get('/admin/', (_req, res) =>
  res.sendFile(
    path.join(
      publicDir,
      'admin.html'
    )
  )
);

// --------------------------------------------------
// AUTH
// --------------------------------------------------

const safeUser = u => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role
});

const sessionCookie = (res, user) =>
  res.cookie(
    'ps_token',
    signUser(user),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env.NODE_ENV ===
        'production',
      maxAge:
        7 * 24 * 60 * 60 * 1000
    }
  );

app.post(
  '/api/auth/register',
  async (req, res) => {
    const email =
      String(
        req.body.email || ''
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        req.body.password || ''
      );

    const name =
      String(
        req.body.name || ''
      ).trim();

    if (
      !email ||
      !password ||
      password.length < 8
    ) {
      return res.status(400).json({
        error:
          'Email and password (8+ chars) are required.'
      });
    }

    try {
      const hash =
        await hashPassword(
          password
        );

      const r = db
        .prepare(`
          INSERT INTO users(
            email,
            password_hash,
            name
          )
          VALUES(?,?,?)
        `)
        .run(
          email,
          hash,
          name
        );

      const user = db
        .prepare(`
          SELECT
            id,
            email,
            name,
            role
          FROM users
          WHERE id=?
        `)
        .get(
          r.lastInsertRowid
        );

      sessionCookie(
        res,
        user
      );

      res.json({
        user
      });

    } catch {
      res.status(409).json({
        error:
          'That email is already registered.'
      });
    }
  }
);

app.post(
  '/api/auth/login',
  async (req, res) => {
    const email =
      String(
        req.body.email || ''
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        req.body.password || ''
      );

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE email=?
      `)
      .get(email);

    if (
      !user ||
      !(await comparePassword(
        password,
        user.password_hash
      ))
    ) {
      return res.status(401).json({
        error:
          'Invalid email or password.'
      });
    }

    const safe =
      safeUser(user);

    sessionCookie(
      res,
      safe
    );

    res.json({
      user: safe
    });
  }
);

app.post(
  '/api/auth/logout',
  (_req, res) => {
    res.clearCookie(
      'ps_token'
    );

    res.json({
      ok: true
    });
  }
);

app.get(
  '/api/auth/me',
  (req, res) => {
    try {
      const token =
        req.cookies.ps_token;

      if (!token) {
        return res.json({
          user: null
        });
      }

      const decoded =
        verifyToken(token);

      const user = db
        .prepare(`
          SELECT
            id,
            email,
            name,
            role
          FROM users
          WHERE id=?
        `)
        .get(decoded.id);

      res.json({
        user: user || null
      });

    } catch {
      res.json({
        user: null
      });
    }
  }
);

// --------------------------------------------------
// PRODUCTS
// --------------------------------------------------

app.get(
  '/api/products',
  (req, res) => {
    const q =
      String(
        req.query.q || ''
      ).trim();

    const category =
      String(
        req.query.category || ''
      ).trim();

    const type =
      String(
        req.query.type || ''
      ).trim();

    const sort =
      String(
        req.query.sort ||
        'newest'
      );

    let sql = `
      SELECT
        id,
        slug,
        title,
        description,
        category,
        software,
        version,
        type,
        price_cents,
        thumbnail,
        preview,
        download_count,
        created_at
      FROM products
      WHERE active=1
    `;

    const args = [];

    if (q) {
      sql += `
        AND (
          title LIKE ?
          OR description LIKE ?
          OR category LIKE ?
          OR software LIKE ?
        )
      `;

      const x = `%${q}%`;

      args.push(
        x,
        x,
        x,
        x
      );
    }

    if (category) {
      sql +=
        ' AND category=?';

      args.push(
        category
      );
    }

    if (type) {
      sql +=
        ' AND type=?';

      args.push(type);
    }

    sql +=
      sort === 'popular'
        ? `
          ORDER BY
            download_count DESC,
            datetime(created_at) DESC
        `
        : sort === 'price_low'
          ? `
            ORDER BY
              price_cents ASC,
              datetime(created_at) DESC
          `
          : `
            ORDER BY
              datetime(created_at) DESC
          `;

    res.json({
      products:
        db
          .prepare(sql)
          .all(...args)
    });
  }
);

app.get(
  '/api/products/:slug',
  (req, res) => {
    const p = db
      .prepare(`
        SELECT
          id,
          slug,
          title,
          description,
          category,
          software,
          version,
          type,
          price_cents,
          thumbnail,
          preview,
          download_count,
          created_at
        FROM products
        WHERE slug=?
        AND active=1
      `)
      .get(
        req.params.slug
      );

    if (!p) {
      return res.status(404).json({
        error:
          'Product not found'
      });
    }

    res.json({
      product: p
    });
  }
);

// --------------------------------------------------
// LIBRARY
// --------------------------------------------------

app.get(
  '/api/library',
  requireAuth,
  (req, res) => {
    const member =
      db
        .prepare(`
          SELECT id
          FROM premium_memberships
          WHERE user_id=?
          AND status='active'
          AND datetime(expires_at)
              > datetime('now')
          LIMIT 1
        `)
        .get(req.user.id);

    const products =
      db.prepare(`
        SELECT
          p.id,
          p.slug,
          p.title,
          p.description,
          p.category,
          p.software,
          p.version,
          p.type,
          p.price_cents,
          p.thumbnail,
          p.preview,
          p.download_count,
          pu.created_at purchased_at
        FROM purchases pu
        JOIN products p
          ON p.id=pu.product_id
        WHERE pu.user_id=?
        AND pu.status='paid'

        ${
          member
            ? `
              UNION

              SELECT
                p.id,
                p.slug,
                p.title,
                p.description,
                p.category,
                p.software,
                p.version,
                p.type,
                p.price_cents,
                p.thumbnail,
                p.preview,
                p.download_count,
                NULL purchased_at
              FROM products p
              WHERE p.active=1
              AND p.type='premium'
            `
            : ''
        }

        ORDER BY id DESC
      `)
        .all(req.user.id);

    res.json({
      products,
      premium_active:
        !!member
    });
  }
);

// --------------------------------------------------
// FILE SAFETY
// --------------------------------------------------

function isSafeStoredPath(
  value,
  allowedRoots
) {
  if (!value) {
    return false;
  }

  const resolved =
    path.resolve(value);

  return allowedRoots.some(
    root =>
      resolved === root ||
      resolved.startsWith(
        root + path.sep
      )
  );
}

function deleteStoredFile(
  value
) {
  if (!value) {
    return;
  }

  const roots = [
    assetDir,
    mediaDir,
    proofDir,
    path.join(
      publicDir,
      'uploads'
    )
  ];

  if (
    isSafeStoredPath(
      value,
      roots
    )
  ) {
    fs.rmSync(
      path.resolve(value),
      {
        force: true
      }
    );
  }
}

// --------------------------------------------------
// DOWNLOADS
// --------------------------------------------------

function downloadProduct(
  req,
  res
) {
  const p = db
    .prepare(`
      SELECT *
      FROM products
      WHERE id=?
      AND active=1
    `)
    .get(req.params.id);

  if (
    !p ||
    !p.file_path
  ) {
    return res.status(404).json({
      error:
        'File unavailable. The creator has not uploaded the asset yet.'
    });
  }

  const loggedIn =
    !!req.user;

  const membershipActive =
    loggedIn &&
    !!getActiveMembership(
      req.user.id
    );

  const oldPurchase =
    loggedIn &&
    !!db
      .prepare(`
        SELECT 1
        FROM purchases
        WHERE user_id=?
        AND product_id=?
        AND status='paid'
      `)
      .get(
        req.user.id,
        p.id
      );

  const allowed =
    p.type === 'free' ||
    (
      loggedIn &&
      (
        oldPurchase ||
        membershipActive
      )
    );

  if (!allowed) {
    return res.status(403).json({
      error:
        'Premium Membership required.'
    });
  }

  const absolute =
    path.resolve(
      p.file_path
    );

  if (
    !isSafeStoredPath(
      absolute,
      [
        assetDir,
        path.join(
          publicDir,
          'uploads'
        )
      ]
    )
  ) {
    return res.status(403).json({
      error:
        'Invalid file location.'
    });
  }

  if (
    !fs.existsSync(
      absolute
    )
  ) {
    return res.status(404).json({
      error:
        'File missing on server.'
    });
  }

  db.prepare(`
    INSERT INTO downloads(
      user_id,
      product_id
    )
    VALUES(?,?)
  `).run(
    loggedIn
      ? req.user.id
      : null,
    p.id
  );

  db.prepare(`
    UPDATE products
    SET download_count=
      download_count+1
    WHERE id=?
  `).run(
    p.id
  );

  res.download(
    absolute,
    p.file_name ||
      path.basename(
        absolute
      )
  );
}

app.get(
  '/api/products/:id/download',
  (req, res) => {
    const token =
      req.cookies.ps_token;

    if (!token) {
      req.user = null;
      return downloadProduct(
        req,
        res
      );
    }

    try {
      req.user =
        verifyToken(token);
    } catch {
      req.user = null;
    }

    downloadProduct(
      req,
      res
    );
  }
);

// --------------------------------------------------
// MANUAL KBZ PAY PREMIUM MEMBERSHIP
// --------------------------------------------------

const PREMIUM_YEAR_AMOUNT_CENTS =
  3000000;

// 30,000 MMK / 365 days

const PREMIUM_PAYMENT = {
  method: 'KBZ Pay',
  accountName:
    'PaugPyinSang',
  phone:
    '0897185588'
};

const PREMIUM_PLANS = [
  {
    months: 12,
    days: 365,
    amount_cents:
      PREMIUM_YEAR_AMOUNT_CENTS
  }
];

function addDaysISO(
  date,
  days
) {
  const d =
    new Date(date);

  d.setDate(
    d.getDate() +
    Number(days || 0)
  );

  return d.toISOString();
}

function getActiveMembership(
  userId
) {
  return db
    .prepare(`
      SELECT *
      FROM premium_memberships
      WHERE user_id=?
      AND status='active'
      AND datetime(expires_at)
          > datetime('now')
      ORDER BY
        datetime(expires_at)
        DESC
      LIMIT 1
    `)
    .get(userId);
}

function expireMemberships() {
  db.prepare(`
    UPDATE premium_memberships
    SET status='expired'
    WHERE status='active'
    AND datetime(expires_at)
        <= datetime('now')
  `).run();
}

// --------------------------------------------------
// PREMIUM INFO
// --------------------------------------------------

app.get(
  '/api/premium/info',
  requireAuth,
  (req, res) => {
    expireMemberships();

    const membership =
      getActiveMembership(
        req.user.id
      );

    res.json({
      payment:
        PREMIUM_PAYMENT,

      plans:
        PREMIUM_PLANS,

      membership:
        membership
          ? {
              id:
                membership.id,

              plan_months:
                membership.plan_months,

              starts_at:
                membership.starts_at,

              expires_at:
                membership.expires_at,

              status:
                membership.status
            }
          : null
    });
  }
);

// --------------------------------------------------
// PREMIUM PAYMENT REQUEST
// --------------------------------------------------

app.post(
  '/api/premium/request',
  requireAuth,
  proofUpload.single(
    'screenshot'
  ),
  (req, res) => {
    const months =
      Number(
        req.body.plan_months
      );

    const transactionId =
      String(
        req.body.transaction_id ||
        ''
      ).trim();

    const plan =
      PREMIUM_PLANS.find(
        x =>
          x.months ===
          months
      );

    if (!plan) {
      if (req.file) {
        deleteStoredFile(
          req.file.path
        );
      }

      return res.status(400).json({
        error:
          'Invalid premium plan.'
      });
    }

    if (
      !/^\d{6}$/.test(
        transactionId
      )
    ) {
      if (req.file) {
        deleteStoredFile(
          req.file.path
        );
      }

      return res.status(400).json({
        error:
          'Transaction No/ID ၏ နောက်ဆုံးဂဏန်း ၆ လုံးကိုသာ ထည့်ပေးပါ။'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error:
          'Payment screenshot is required.'
      });
    }

    const pending =
      db
        .prepare(`
          SELECT id
          FROM payment_requests
          WHERE user_id=?
          AND status='pending'
          LIMIT 1
        `)
        .get(req.user.id);

    if (pending) {
      deleteStoredFile(
        req.file.path
      );

      return res.status(409).json({
        error:
          'You already have a payment waiting for admin verification.'
      });
    }

    const result =
      db.prepare(`
        INSERT INTO payment_requests(
          user_id,
          plan_months,
          amount_cents,
          payment_method,
          transaction_id,
          screenshot_path
        )
        VALUES(?,?,?,?,?,?)
      `).run(
        req.user.id,
        months,
        plan.amount_cents,
        PREMIUM_PAYMENT.method,
        transactionId,
        path.resolve(
          req.file.path
        )
      );

    res.json({
      ok: true,
      request_id:
        result.lastInsertRowid,
      message:
        'Payment proof submitted. Please wait for admin verification.'
    });
  }
);

// --------------------------------------------------
// PREMIUM STATUS
// --------------------------------------------------

app.get(
  '/api/premium/status',
  requireAuth,
  (req, res) => {
    expireMemberships();

    const membership =
      getActiveMembership(
        req.user.id
      );

    const pending =
      db
        .prepare(`
          SELECT
            id,
            plan_months,
            amount_cents,
            transaction_id,
            status,
            created_at
          FROM payment_requests
          WHERE user_id=?
          ORDER BY id DESC
          LIMIT 1
        `)
        .get(req.user.id);

    res.json({
      active:
        !!membership,

      membership:
        membership
          ? {
              expires_at:
                membership.expires_at,

              plan_months:
                membership.plan_months
            }
          : null,

      pending:
        pending || null
    });
  }
);

// --------------------------------------------------
// DISABLE INDIVIDUAL PRODUCT CHECKOUT
// --------------------------------------------------
// Premium assets are membership-only.
// There is no per-product purchase flow anymore.
// --------------------------------------------------

app.post(
  '/api/checkout/:id',
  requireAuth,
  (req, res) => {
    const p = db
      .prepare(`
        SELECT *
        FROM products
        WHERE id=?
        AND active=1
      `)
      .get(req.params.id);

    if (!p) {
      return res.status(404).json({
        error:
          'Product not found'
      });
    }

    if (
      p.type === 'premium'
    ) {
      return res.status(400).json({
        error:
          'Premium products are available through Premium Membership only.',
        membership_url:
          '/premium.html'
      });
    }

    return res.status(400).json({
      error:
        'This product is free and does not require checkout.'
    });
  }
);

// --------------------------------------------------
// ADMIN STATS
// --------------------------------------------------

app.get(
  '/api/admin/stats',
  requireAuth,
  requireAdmin,
  (req, res) =>
    res.json({
      users:
        db
          .prepare(
            'SELECT COUNT(*) c FROM users'
          )
          .get().c,

      products:
        db
          .prepare(
            'SELECT COUNT(*) c FROM products WHERE active=1'
          )
          .get().c,

      purchases:
        db
          .prepare(
            "SELECT COUNT(*) c FROM purchases WHERE status='paid'"
          )
          .get().c,

      downloads:
        db
          .prepare(
            'SELECT COUNT(*) c FROM downloads'
          )
          .get().c,

      revenue:
        db
          .prepare(
            "SELECT COALESCE(SUM(amount_cents),0) c FROM purchases WHERE status='paid'"
          )
          .get().c
    })
);

// --------------------------------------------------
// ADMIN PRODUCTS
// --------------------------------------------------

app.get(
  '/api/admin/products',
  requireAuth,
  requireAdmin,
  (req, res) =>
    res.json({
      products:
        db
          .prepare(
            'SELECT * FROM products ORDER BY id DESC'
          )
          .all()
    })
);

function normalizeSlug(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9-]+/g,
      '-'
    )
    .replace(
      /^-|-$/g,
      ''
    );
}

// --------------------------------------------------
// CREATE PRODUCT
// --------------------------------------------------

app.post(
  '/api/admin/products',
  requireAuth,
  requireAdmin,
  upload.fields([
    {
      name: 'file',
      maxCount: 1
    },
    {
      name: 'thumbnailFile',
      maxCount: 1
    },
    {
      name: 'previewFile',
      maxCount: 1
    }
  ]),
  (req, res) => {
    const b =
      req.body;

    const slug =
      normalizeSlug(
        b.slug
      );

    const files =
      req.files || {};

    const asset =
      files.file?.[0];

    const thumb =
      files.thumbnailFile?.[0];

    const preview =
      files.previewFile?.[0];

    if (
      !b.title ||
      !slug ||
      !b.category
    ) {
      [
        asset,
        thumb,
        preview
      ]
        .filter(Boolean)
        .forEach(f =>
          deleteStoredFile(
            f.path
          )
        );

      return res.status(400).json({
        error:
          'Title, slug and category are required.'
      });
    }

    try {
      const type =
        b.type === 'premium'
          ? 'premium'
          : 'free';

      // No individual product price.
      const priceCents = 0;

      const r =
        db.prepare(`
          INSERT INTO products(
            slug,
            title,
            description,
            category,
            software,
            version,
            type,
            price_cents,
            thumbnail,
            preview,
            file_name,
            file_path
          )
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          slug,
          b.title,
          b.description || '',
          b.category,
          b.software || '',
          b.version || '1.0',
          type,
          priceCents,

          thumb
            ? `/uploads/media/${path.basename(thumb.path)}`
            : (b.thumbnail || ''),

          preview
            ? `/uploads/media/${path.basename(preview.path)}`
            : (b.preview || ''),

          asset?.originalname || '',

          asset
            ? path.resolve(
                asset.path
              )
            : ''
        );

      res.json({
        ok: true,
        id: r.lastInsertRowid
      });

    } catch (err) {
      [
        asset,
        thumb,
        preview
      ]
        .filter(Boolean)
        .forEach(f =>
          deleteStoredFile(
            f.path
          )
        );

      res.status(400).json({
        error:
          err.code ===
          'SQLITE_CONSTRAINT_UNIQUE'
            ? 'Slug already exists.'
            : 'Could not create product.'
      });
    }
  }
);

// --------------------------------------------------
// UPDATE PRODUCT
// --------------------------------------------------

app.patch(
  '/api/admin/products/:id',
  requireAuth,
  requireAdmin,
  upload.fields([
    {
      name: 'file',
      maxCount: 1
    },
    {
      name: 'thumbnailFile',
      maxCount: 1
    },
    {
      name: 'previewFile',
      maxCount: 1
    }
  ]),
  (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const existing =
      db
        .prepare(
          'SELECT * FROM products WHERE id=?'
        )
        .get(id);

    if (!existing) {
      Object.values(
        req.files || {}
      )
        .flat()
        .forEach(f =>
          deleteStoredFile(
            f.path
          )
        );

      return res.status(404).json({
        error:
          'Product not found.'
      });
    }

    const b =
      req.body;

    const slug =
      normalizeSlug(
        b.slug
      );

    const files =
      req.files || {};

    const asset =
      files.file?.[0];

    const thumb =
      files.thumbnailFile?.[0];

    const preview =
      files.previewFile?.[0];

    if (
      !b.title ||
      !slug ||
      !b.category
    ) {
      [
        asset,
        thumb,
        preview
      ]
        .filter(Boolean)
        .forEach(f =>
          deleteStoredFile(
            f.path
          )
        );

      return res.status(400).json({
        error:
          'Title, slug and category are required.'
      });
    }

    try {
      const duplicate =
        db
          .prepare(`
            SELECT id
            FROM products
            WHERE slug=?
            AND id<>?
          `)
          .get(
            slug,
            id
          );

      if (duplicate) {
        throw Object.assign(
          new Error(
            'duplicate'
          ),
          {
            code:
              'SQLITE_CONSTRAINT_UNIQUE'
          }
        );
      }

      const type =
        b.type === 'premium'
          ? 'premium'
          : 'free';

      // No individual product price.
      const priceCents = 0;

      const nextThumb =
        b.clearThumbnail === '1'
          ? ''
          : (
              thumb
                ? `/uploads/media/${path.basename(thumb.path)}`
                : (
                    b.thumbnail ??
                    existing.thumbnail ??
                    ''
                  )
            );

      const nextPreview =
        b.clearPreview === '1'
          ? ''
          : (
              preview
                ? `/uploads/media/${path.basename(preview.path)}`
                : (
                    b.preview ??
                    existing.preview ??
                    ''
                  )
            );

      const nextAsset =
        asset
          ? {
              file_name:
                asset.originalname,
              file_path:
                path.resolve(
                  asset.path
                )
            }
          : {
              file_name:
                existing.file_name ||
                '',
              file_path:
                existing.file_path ||
                ''
            };

      db.prepare(`
        UPDATE products
        SET
          slug=?,
          title=?,
          description=?,
          category=?,
          software=?,
          version=?,
          type=?,
          price_cents=?,
          thumbnail=?,
          preview=?,
          file_name=?,
          file_path=?
        WHERE id=?
      `).run(
        slug,
        b.title,
        b.description || '',
        b.category,
        b.software || '',
        b.version || '1.0',
        type,
        priceCents,
        nextThumb,
        nextPreview,
        nextAsset.file_name,
        nextAsset.file_path,
        id
      );

      if (
        thumb &&
        existing.thumbnail?.startsWith(
          '/uploads/media/'
        )
      ) {
        deleteStoredFile(
          path.join(
            publicDir,
            existing.thumbnail.replace(
              /^\//,
              ''
            )
          )
        );
      }

      if (
        preview &&
        existing.preview?.startsWith(
          '/uploads/media/'
        )
      ) {
        deleteStoredFile(
          path.join(
            publicDir,
            existing.preview.replace(
              /^\//,
              ''
            )
          )
        );
      }

      if (
        asset &&
        existing.file_path
      ) {
        deleteStoredFile(
          existing.file_path
        );
      }

      if (
        b.clearThumbnail === '1' &&
        existing.thumbnail?.startsWith(
          '/uploads/media/'
        )
      ) {
        deleteStoredFile(
          path.join(
            publicDir,
            existing.thumbnail.replace(
              /^\//,
              ''
            )
          )
        );
      }

      if (
        b.clearPreview === '1' &&
        existing.preview?.startsWith(
          '/uploads/media/'
        )
      ) {
        deleteStoredFile(
          path.join(
            publicDir,
            existing.preview.replace(
              /^\//,
              ''
            )
          )
        );
      }

      if (
        !asset &&
        existing.file_path &&
        b.clearAsset === '1'
      ) {
        deleteStoredFile(
          existing.file_path
        );

        db.prepare(`
          UPDATE products
          SET
            file_name="",
            file_path=""
          WHERE id=?
        `).run(id);
      }

      res.json({
        ok: true
      });

    } catch (err) {
      [
        asset,
        thumb,
        preview
      ]
        .filter(Boolean)
        .forEach(f =>
          deleteStoredFile(
            f.path
          )
        );

      res.status(400).json({
        error:
          err.code ===
          'SQLITE_CONSTRAINT_UNIQUE'
            ? 'Slug already exists.'
            : 'Could not update product.'
      });
    }
  }
);

// --------------------------------------------------
// ARCHIVE PRODUCT
// --------------------------------------------------

app.delete(
  '/api/admin/products/:id',
  requireAuth,
  requireAdmin,
  (req, res) => {
    const p = db
      .prepare(`
        SELECT
          file_path,
          thumbnail,
          preview
        FROM products
        WHERE id=?
      `)
      .get(
        req.params.id
      );

    db.prepare(`
      UPDATE products
      SET active=0
      WHERE id=?
    `).run(
      req.params.id
    );

    if (p?.file_path) {
      deleteStoredFile(
        p.file_path
      );
    }

    if (
      p?.thumbnail?.startsWith(
        '/uploads/media/'
      )
    ) {
      deleteStoredFile(
        path.join(
          publicDir,
          p.thumbnail
        )
      );
    }

    if (
      p?.preview?.startsWith(
        '/uploads/media/'
      )
    ) {
      deleteStoredFile(
        path.join(
          publicDir,
          p.preview
        )
      );
    }

    res.json({
      ok: true
    });
  }
);

// --------------------------------------------------
// RESTORE PRODUCT
// --------------------------------------------------

app.post(
  '/api/admin/products/:id/restore',
  requireAuth,
  requireAdmin,
  (req, res) => {
    const p =
      db
        .prepare(
          'SELECT id FROM products WHERE id=?'
        )
        .get(
          req.params.id
        );

    if (!p) {
      return res.status(404).json({
        error:
          'Product not found.'
      });
    }

    db.prepare(`
      UPDATE products
      SET active=1
      WHERE id=?
    `).run(
      req.params.id
    );

    res.json({
      ok: true
    });
  }
);

// --------------------------------------------------
// ADMIN PAYMENTS
// --------------------------------------------------

app.get(
  '/api/admin/payments',
  requireAuth,
  requireAdmin,
  (req, res) => {
    const rows =
      db.prepare(`
        SELECT
          pr.id,
          pr.plan_months,
          pr.amount_cents,
          pr.payment_method,
          pr.transaction_id,
          pr.screenshot_path,
          pr.status,
          pr.admin_note,
          pr.created_at,
          pr.reviewed_at,
          u.email,
          u.name
        FROM payment_requests pr
        JOIN users u
          ON u.id=pr.user_id
        ORDER BY
          CASE pr.status
            WHEN 'pending' THEN 0
            ELSE 1
          END,
          datetime(pr.created_at) DESC
      `).all();

    res.json({
      payments:
        rows.map(x => ({
          ...x,
          screenshot_url:
            x.screenshot_path
              ? `/api/admin/payments/${x.id}/proof`
              : ''
        }))
    });
  }
);

// --------------------------------------------------
// PAYMENT PROOF
// --------------------------------------------------

app.get(
  '/api/admin/payments/:id/proof',
  requireAuth,
  requireAdmin,
  (req, res) => {
    const row =
      db
        .prepare(`
          SELECT screenshot_path
          FROM payment_requests
          WHERE id=?
        `)
        .get(
          Number(
            req.params.id
          )
        );

    if (
      !row?.screenshot_path ||
      !fs.existsSync(
        row.screenshot_path
      )
    ) {
      return res
        .status(404)
        .send(
          'Proof not found'
        );
    }

    res.sendFile(
      path.resolve(
        row.screenshot_path
      )
    );
  }
);

// --------------------------------------------------
// APPROVE PREMIUM PAYMENT
// --------------------------------------------------

app.post(
  '/api/admin/payments/:id/approve',
  requireAuth,
  requireAdmin,
  (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const row =
      db
        .prepare(`
          SELECT *
          FROM payment_requests
          WHERE id=?
        `)
        .get(id);

    if (!row) {
      return res.status(404).json({
        error:
          'Payment request not found.'
      });
    }

    if (
      row.status !==
      'pending'
    ) {
      return res.status(400).json({
        error:
          'This request has already been reviewed.'
      });
    }

    const now =
      new Date();

    const existing =
      getActiveMembership(
        row.user_id
      );

    const start =
      existing &&
      new Date(
        existing.expires_at
      ) > now
        ? new Date(
            existing.expires_at
          )
        : now;

    const expires =
      addDaysISO(
        start,
        row.plan_months === 12
          ? 365
          : row.plan_months * 30
      );

    const tx =
      db.transaction(
        () => {
          if (existing) {
            db.prepare(`
              UPDATE premium_memberships
              SET
                expires_at=?,
                plan_months=
                  plan_months+?,
                amount_cents=
                  amount_cents+?,
                payment_request_id=?
              WHERE id=?
            `).run(
              expires,
              row.plan_months,
              row.amount_cents,
              id,
              existing.id
            );
          } else {
            db.prepare(`
              INSERT INTO premium_memberships(
                user_id,
                plan_months,
                amount_cents,
                starts_at,
                expires_at,
                status,
                payment_request_id
              )
              VALUES(?,?,?,?,?,'active',?)
            `).run(
              row.user_id,
              row.plan_months,
              row.amount_cents,
              now.toISOString(),
              expires,
              id
            );
          }

          db.prepare(`
            UPDATE payment_requests
            SET
              status='approved',
              reviewed_at=CURRENT_TIMESTAMP,
              reviewed_by=?
            WHERE id=?
          `).run(
            req.user.id,
            id
          );
        }
      );

    tx();

    res.json({
      ok: true,
      expires_at:
        expires
    });
  }
);

// --------------------------------------------------
// REJECT PREMIUM PAYMENT
// --------------------------------------------------

app.post(
  '/api/admin/payments/:id/reject',
  requireAuth,
  requireAdmin,
  (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const row =
      db
        .prepare(`
          SELECT *
          FROM payment_requests
          WHERE id=?
        `)
        .get(id);

    if (!row) {
      return res.status(404).json({
        error:
          'Payment request not found.'
      });
    }

    if (
      row.status !==
      'pending'
    ) {
      return res.status(400).json({
        error:
          'This request has already been reviewed.'
      });
    }

    db.prepare(`
      UPDATE payment_requests
      SET
        status='rejected',
        admin_note=?,
        reviewed_at=CURRENT_TIMESTAMP,
        reviewed_by=?
      WHERE id=?
    `).run(
      String(
        req.body.note || ''
      ).trim(),
      req.user.id,
      id
    );

    res.json({
      ok: true
    });
  }
);

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get(
  '/api/health',
  (_req, res) =>
    res.json({
      ok: true,
      service:
        'PS Creative Hub',
      version:
        '7.0'
    })
);

// --------------------------------------------------
// SPA FALLBACK
// --------------------------------------------------

app.use(
  (req, res, next) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith(
        '/api/'
      )
    ) {
      return res.sendFile(
        path.join(
          publicDir,
          'index.html'
        )
      );
    }

    next();
  }
);

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use(
  (_req, res) =>
    res.status(404).json({
      error:
        'Not found'
    })
);

// --------------------------------------------------
// START
// --------------------------------------------------

app.listen(
  PORT,
  () =>
    console.log(
      `\nPS Creative Hub V7 running at http://localhost:${PORT}\n`
    )
);