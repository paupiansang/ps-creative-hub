require("dotenv").config();
const db = require("./db");
const fs = require("fs");
const path = require("path");
const { hashPassword } = require("./auth");

(async()=>{
  const adminEmail=process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword=process.env.ADMIN_PASSWORD || "change-this-password";
  const exists=db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if(!exists){
    const hash=await hashPassword(adminPassword);
    db.prepare("INSERT INTO users(email,password_hash,name,role) VALUES(?,?,?,?)").run(adminEmail,hash,"PS","admin");
  }
  const products=[
    ["ps-hover-scale-toolkit","PS Hover Scale Toolkit","Reusable After Effects hover scale workflow.","After Effects","AE","V1","free",0],
    ["ps-countdown-kit","PS Countdown Kit","Clean reusable countdown system for motion projects.","After Effects","AE","V1","premium",500],
    ["ps-text-toolkit","PS Text Toolkit","Fast text animation helpers and reusable controls.","After Effects","AE","V1","premium",700],
    ["cinematic-whoosh-pack","Cinematic Whoosh SFX Pack","A starter SFX pack for transitions and motion graphics.","SFX","","V1","free",0]
  ];
  for(const x of products){
    db.prepare(`INSERT OR IGNORE INTO products(slug,title,description,category,software,version,type,price_cents) VALUES(?,?,?,?,?,?,?,?)`).run(...x);
  }
  const thumbnailMap = {
    "ps-hover-scale-toolkit": "/assets/thumbs/ps-hover-scale-toolkit.svg",
    "ps-countdown-kit": "/assets/thumbs/ps-countdown-kit.svg",
    "ps-text-toolkit": "/assets/thumbs/ps-text-toolkit.svg",
    "cinematic-whoosh-pack": "/assets/thumbs/cinematic-whoosh-pack.svg"
  };
  for (const [slug, thumbnail] of Object.entries(thumbnailMap)) {
    db.prepare("UPDATE products SET thumbnail=? WHERE slug=? AND (thumbnail IS NULL OR thumbnail='')").run(thumbnail, slug);
  }
  // Auto-link tracked assets in storage/assets to products so Render can serve
  // files committed to GitHub even when the product was seeded without an upload.
  const assetDir = path.join(__dirname, "storage", "assets");
  const files = fs.existsSync(assetDir) ? fs.readdirSync(assetDir) : [];
  const mappings = [
    { slug: "ps-hover-scale-toolkit", match: "PS_Universal_Hover_Scale_Toolkit_V3_2_STABLE" },
    { slug: "ps-countdown-kit", match: "PS_Countdown_Kit_V15_RESIZABLE_HOVER_STYLE" }
  ];
  for (const { slug, match } of mappings) {
    const filename = files.find(name => name.toLowerCase().includes(match.toLowerCase()));
    if (!filename) continue;
    const filePath = path.resolve(assetDir, filename);
    db.prepare("UPDATE products SET file_name=?, file_path=? WHERE slug=?").run(filename, filePath, slug);
  }
  console.log("PS Creative Hub V7 seed complete. Admin:",adminEmail);
})();
