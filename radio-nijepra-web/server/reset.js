// Borra la base de datos para empezar de cero (npm run reset-db).
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
for (const f of ['radio-nijepra.db', 'radio-nijepra.db-wal', 'radio-nijepra.db-shm']) {
  const p = path.join(DATA_DIR, f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log('Base de datos borrada. Al iniciar el servidor se crea de nuevo con el administrador inicial.');
