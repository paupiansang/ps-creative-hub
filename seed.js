require("dotenv").config();
const db = require("./db");
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
  console.log("PS Creative Hub V7 seed complete. Admin:",adminEmail);
})();
