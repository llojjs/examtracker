const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const EXAMS_FILE = path.join(DATA_DIR, 'exams.json');

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonSafe(file, fallback) {
  try {
    const txt = await fsp.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const txt = JSON.stringify(data, null, 2);
  await fsp.writeFile(tmp, txt, 'utf8');
  await fsp.rename(tmp, file);
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  if (crypto.randomUUID) return `exam-${crypto.randomUUID()}`;
  return `exam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class ExamsStore {
  async _loadAll() {
    await ensureDataDir();
    const data = await readJsonSafe(EXAMS_FILE, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    return data;
  }

  async _saveAll(data) {
    await ensureDataDir();
    await writeJsonAtomic(EXAMS_FILE, data);
  }

  async list() {
    const data = await this._loadAll();
    return data.items;
  }

  async get(id) {
    const data = await this._loadAll();
    return data.items.find((e) => e.id === id) || null;
  }

  async create(payload) {
    const data = await this._loadAll();
    const id = payload.id || makeId();
    if (data.items.some((e) => e.id === id)) {
      throw new Error('ID already exists');
    }
    const item = {
      ...payload,
      id,
      uploadDate: payload.uploadDate || nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.items.push(item);
    await this._saveAll(data);
    return item;
  }

  async update(id, patch) {
    const data = await this._loadAll();
    const idx = data.items.findIndex((e) => e.id === id);
    if (idx === -1) {
      // upsert behavior
      const created = await this.create({ ...patch, id });
      return created;
    }
    const prev = data.items[idx];
    const next = { ...prev, ...patch, id, updatedAt: nowIso() };
    data.items[idx] = next;
    await this._saveAll(data);
    return next;
  }

  async remove(id) {
    const data = await this._loadAll();
    const before = data.items.length;
    data.items = data.items.filter((e) => e.id !== id);
    const changed = data.items.length !== before;
    if (changed) await this._saveAll(data);
    return changed;
  }
}

module.exports = { ExamsStore };

