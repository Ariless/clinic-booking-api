const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const Database = require("better-sqlite3");

const dbPath = path.resolve(process.cwd(), env.DATABASE_PATH);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

module.exports = db;
