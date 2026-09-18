require("dotenv").config();
const db = require("./db");
const fs = require("fs");
const path = require("path");
const { hashPassword } = require("./auth");

(async () => {
  const adminEmail =
    process.env.ADMIN_EMAIL || "admin@example.com";

  const adminPassword =
    process.env.ADMIN_PASSWORD || "change-this-password";

  // --------------------------------------------------
  // ADMIN USER
  // --------------------------------------------------
  const exists = db
    .prepare("SELECT id FROM users WHERE email=?")
    .get(adminEmail);

  if (!exists) {
    const hash = await hashPassword(adminPassword);

    db.prepare(`
      INSERT INTO users(email,password_hash,name,role)
      VALUES(?,?,?,?)
    `).run(
      adminEmail,
      hash,
      "PS",
      "admin"
    );
  }

  // --------------------------------------------------
  // PRODUCTS
  // --------------------------------------------------
  const products = [
    [
      "ps-hover-scale-toolkit",
      "PS Hover Scale Toolkit",
      "Reusable After Effects hover scale workflow.",
      "After Effects",
      "AE",
      "V1",
      "free",
      0
    ],

    [
      "ps-countdown-kit",
      "PS Countdown Kit",
      "Clean reusable countdown system for motion projects.",
      "After Effects",
      "AE",
      "V1",
      "premium",
      500
    ],

    [
      "ps-text-toolkit",
      "PS Text Toolkit",
      "Fast text animation helpers and reusable controls.",
      "After Effects",
      "AE",
      "V1",
      "premium",
      700
    ],

    [
      "cinematic-whoosh-pack",
      "Cinematic Whoosh SFX Pack",
      "A starter SFX pack for transitions and motion graphics.",
      "SFX",
      "",
      "V1",
      "free",
      0
    ]
  ];

  for (const x of products) {
    db.prepare(`
      INSERT OR IGNORE INTO products(
        slug,
        title,
        description,
        category,
        software,
        version,
        type,
        price_cents
      )
      VALUES(?,?,?,?,?,?,?,?)
    `).run(...x);
  }

  // --------------------------------------------------
  // FORCE UPLOADED THUMBNAILS
  // --------------------------------------------------
  //
  // These files are committed to:
  // public/uploads/media/
  //
  // So Render can serve them after deploy.
  //
  const thumbnailMap = {
    "ps-hover-scale-toolkit":
      "/uploads/media/1789656467624-qamtjg-mouse-cursor.png",

    "ps-countdown-kit":
      "/uploads/media/1789656710497-ek8w5b-ChatGPT_Image_Jul_20_2026_12_01_06_AM.png",

    "ps-text-toolkit":
      "/uploads/media/1789656512703-5t4lsm-human-brain-anatomy-model-detailed-view-cerebrum-cerebellum.png",

    "cinematic-whoosh-pack":
      "/uploads/media/1789656541879-yk8ik3-ChatGPT_Image_Jul_27_2026_10_22_15_PM.png"
  };

  for (const [slug, thumbnail] of Object.entries(thumbnailMap)) {
    db.prepare(`
      UPDATE products
      SET thumbnail=?
      WHERE slug=?
    `).run(thumbnail, slug);
  }

  // --------------------------------------------------
  // AUTO-LINK TRACKED DOWNLOAD ASSETS
  // --------------------------------------------------
  const assetDir = path.join(
    __dirname,
    "storage",
    "assets"
  );

  const files = fs.existsSync(assetDir)
    ? fs.readdirSync(assetDir)
    : [];

  const mappings = [
    {
      slug: "ps-hover-scale-toolkit",
      match: "PS_Universal_Hover_Scale_Toolkit_V3_2_STABLE"
    },

    {
      slug: "ps-countdown-kit",
      match: "PS_Countdown_Kit_V15_RESIZABLE_HOVER_STYLE"
    },

    {
      slug: "ps-text-toolkit",
      match: "PS_Path_Toolkit_V2_CLEAN"
    },

    {
      slug: "ps-text-toolkit",
      match: "PS_PillText_Toolkit_V9_FINAL"
    }
  ];

  for (const { slug, match } of mappings) {
    const filename = files.find(name =>
      name.toLowerCase().includes(
        match.toLowerCase()
      )
    );

    if (!filename) continue;

    const filePath = path.resolve(
      assetDir,
      filename
    );

    db.prepare(`
      UPDATE products
      SET file_name=?,
          file_path=?
      WHERE slug=?
      AND (
        file_path IS NULL
        OR file_path=''
        OR file_name IS NULL
        OR file_name=''
      )
    `).run(
      filename,
      filePath,
      slug
    );
  }

  console.log(
    "PS Creative Hub V7 seed complete. Admin:",
    adminEmail
  );
})();