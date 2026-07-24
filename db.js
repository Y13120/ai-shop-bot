const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// ══════════════════════════════════════════════════════════════
//  SCHEMAS
// ══════════════════════════════════════════════════════════════

const configSchema = new mongoose.Schema({}, { strict: false, minimize: false });
const serviceSchema = new mongoose.Schema({}, { strict: false, minimize: false });
const categorySchema = new mongoose.Schema({}, { strict: false, minimize: false });
const orderSchema = new mongoose.Schema({}, { strict: false, minimize: false });
const creditsSchema = new mongoose.Schema({}, { strict: false, minimize: false });
const reviewSchema = new mongoose.Schema({}, { strict: false, minimize: false });
const warningSchema = new mongoose.Schema({}, { strict: false, minimize: false });
const giveawaySchema = new mongoose.Schema({}, { strict: false, minimize: false });
const raidSchema = new mongoose.Schema({}, { strict: false, minimize: false });
const applicationSchema = new mongoose.Schema({}, { strict: false, minimize: false });

const Config = mongoose.model('Config', configSchema);
const Service = mongoose.model('Service', serviceSchema);
const Category = mongoose.model('Category', categorySchema);
const Order = mongoose.model('Order', orderSchema);
const Credit = mongoose.model('Credit', creditsSchema);
const Review = mongoose.model('Review', reviewSchema);
const Warning = mongoose.model('Warning', warningSchema);
const Giveaway = mongoose.model('Giveaway', giveawaySchema);
const Raid = mongoose.model('Raid', raidSchema);
const Application = mongoose.model('Application', applicationSchema);

// ══════════════════════════════════════════════════════════════
//  COLLECTION MAP
// ══════════════════════════════════════════════════════════════

const COLLECTIONS = {
  'config.json':         { model: Config,    type: 'single', key: 'key',  idVal: 'main' },
  'services.json':       { model: Service,   type: 'array',  key: 'id' },
  'categories.json':     { model: Category,  type: 'array',  key: 'id' },
  'orders.json':         { model: Order,     type: 'array',  key: 'id' },
  'reviews.json':        { model: Review,    type: 'array',  key: 'id' },
  'warnings.json':       { model: Warning,   type: 'array',  key: 'id' },
  'giveaways.json':      { model: Giveaway,  type: 'array',  key: 'id' },
  'applications.json':   { model: Application, type: 'array', key: '_id' },
  'credits.json':        { model: Credit,    type: 'map',    key: 'userId', valKey: 'amount' },
  'raid.json':           { model: Raid,      type: 'map',    key: 'guildId', valKey: 'data' },
};

// ══════════════════════════════════════════════════════════════
//  IN-MEMORY CACHE
// ══════════════════════════════════════════════════════════════

const _cache = {};
let _dbConnected = false;
let _dirty = new Set();

function loadFromCache(file, fb) {
  if (file in _cache) return _cache[file];
  return fb;
}

function saveToCache(file, d) {
  _cache[file] = JSON.parse(JSON.stringify(d));
  if (_dbConnected) _dirty.add(file);
}

// ══════════════════════════════════════════════════════════════
//  MONGODB FLUSH (async, non-blocking)
// ══════════════════════════════════════════════════════════════

async function flushToMongoDB() {
  if (!_dbConnected || _dirty.size === 0) return;
  const files = [..._dirty];
  _dirty.clear();

  for (const file of files) {
    const meta = COLLECTIONS[file];
    if (!meta) continue;
    const data = _cache[file];
    if (!data) continue;

    try {
      if (meta.type === 'single') {
        const toSet = { ...data };
        if (meta.idVal) toSet[meta.key] = meta.idVal;
        await meta.model.findOneAndUpdate(
          { [meta.key]: meta.idVal },
          { $set: toSet },
          { upsert: true }
        );
      } else if (meta.type === 'array') {
        await meta.model.deleteMany({});
        if (Array.isArray(data) && data.length > 0) {
          await meta.model.insertMany(data.map(d => {
            const obj = typeof d.toObject === 'function' ? d.toObject() : { ...d };
            return obj;
          }));
        }
      } else if (meta.type === 'map') {
        await meta.model.deleteMany({});
        const entries = Object.entries(data);
        if (entries.length > 0) {
          if (file === 'credits.json') {
            await Credit.insertMany(entries.map(([userId, amount]) => ({ userId, amount })));
          } else if (file === 'raid.json') {
            await Raid.insertMany(entries.map(([guildId, d]) => ({ guildId, joins: d.joins || [] })));
          }
        }
      }
    } catch (err) {
      console.error(`[DB] Flush error for ${file}:`, err.message);
    }
  }
}

let _flushTimer = null;
function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(async () => {
    _flushTimer = null;
    await flushToMongoDB();
  }, 2000);
}

async function flushNow() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  await flushToMongoDB();
}

process.on('SIGINT', async () => { await flushNow(); process.exit(0); });
process.on('SIGTERM', async () => { await flushNow(); process.exit(0); });

// ══════════════════════════════════════════════════════════════
//  LOAD FROM MONGODB ON STARTUP
// ══════════════════════════════════════════════════════════════

async function loadAllFromMongo() {
  for (const [file, meta] of Object.entries(COLLECTIONS)) {
    try {
      if (meta.type === 'single') {
        const doc = await meta.model.findOne({ [meta.key]: meta.idVal }).lean();
        _cache[file] = doc || null;
      } else if (meta.type === 'array') {
        const docs = await meta.model.find({}).lean();
        _cache[file] = docs || [];
      } else if (meta.type === 'map') {
        if (file === 'credits.json') {
          const docs = await Credit.find({}).lean();
          const map = {};
          docs.forEach(d => { map[d.userId] = d.amount; });
          _cache[file] = map;
        } else if (file === 'raid.json') {
          const docs = await Raid.find({}).lean();
          const map = {};
          docs.forEach(d => { map[d.guildId] = { joins: d.joins || [] }; });
          _cache[file] = map;
        }
      }
    } catch (err) {
      console.error(`[DB] Load error for ${file}:`, err.message);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  SEED DEFAULTS INTO MONGODB
// ══════════════════════════════════════════════════════════════

async function seedDefaults(defaultServices, defaultCategories) {
  if (!_dbConnected) return;

  try {
    const svcCount = await Service.countDocuments();
    if (svcCount === 0 && Array.isArray(defaultServices)) {
      await Service.insertMany(defaultServices.map(s => ({ ...s, createdAt: Date.now() })));
      _cache['services.json'] = JSON.parse(JSON.stringify(defaultServices.map(s => ({ ...s, createdAt: Date.now() }))));
      console.log(`[DB] Seeded ${defaultServices.length} default services`);
    }
  } catch (err) {
    console.error('[DB] Seed services error:', err.message);
  }

  try {
    const catCount = await Category.countDocuments();
    if (catCount === 0 && Array.isArray(defaultCategories)) {
      await Category.insertMany(defaultCategories);
      _cache['categories.json'] = JSON.parse(JSON.stringify(defaultCategories));
      console.log(`[DB] Seeded ${defaultCategories.length} default categories`);
    }
  } catch (err) {
    console.error('[DB] Seed categories error:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
//  CONNECT
// ══════════════════════════════════════════════════════════════

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[DB] No MONGODB_URI — using local JSON files');
    return false;
  }
  try {
    await mongoose.connect(uri, { dbName: 'codex_zone' });
    _dbConnected = true;
    console.log('[DB] Connected to MongoDB Atlas');

    await loadAllFromMongo();
    console.log('[DB] Loaded all data into cache');

    return true;
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    return false;
  }
}

module.exports = {
  connectDB, seedDefaults,
  loadFromCache, saveToCache, scheduleFlush,
  Config, Service, Category, Order, Credit,
  Review, Warning, Giveaway, Raid, Application
};
