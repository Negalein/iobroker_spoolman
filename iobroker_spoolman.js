/**
 * ============================================================
 * ioBroker – Klipper – Spoolman Integration
 * ============================================================
 *
 * Version:   1.0.0
 * Author:    <Negalein>
 * License:   MIT
 *
 * Description:
 * - Liest aktive Spulen aus Klipper (Moonraker)
 * - Holt Restfilament aus Spoolman (SQLite via SSH)
 * - Erstellt automatisch ioBroker-States
 * - 🟢🟡🔴 Ampel-Logik je Spule
 * - Telegram-Warnungen mit Zeit- & Drucklogik
 * ==========================================================
 */

const { exec } = require('child_process');

/* ==========================================================
   KONFIGURATION
   ========================================================== */

const CONFIG = {
  spoolman: {
    sshHost: 'root@10.0.1.148',
    dbPath: '/root/.local/share/spoolman/spoolman.db'
  },

  baseState: '0_userdata.0.3DDrucker.Spoolman',

  limits: {
    warn: 300,
    empty: 100
  },

  warnTimes: {
    weekday: { start: 7, end: 22 },
    weekend: { start: 10, end: 20 }
  },

  extruders: [
    { name: 'T0', state: 'klipper-moonraker.0.gcode_macro T0.spool_id' },
    { name: 'T1', state: 'klipper-moonraker.0.gcode_macro T1.spool_id' },
    { name: 'T2', state: 'klipper-moonraker.0.gcode_macro T2.spool_id' },
    { name: 'T3', state: 'klipper-moonraker.0.gcode_macro T3.spool_id' }
  ],

  schedule: '*/5 * * * *'
};

/* ==========================================================
   STATE HELFER
   ========================================================== */

function ensureState(id, val, type) {
  if (!existsState(id)) {
    createState(id, val, {
      type,
      read: true,
      write: false,
      role: 'value'
    });
  } else {
    setState(id, val, true);
  }
}

/* ==========================================================
   ZEITFENSTER
   ========================================================== */

function isInWarnTime() {
  const now = new Date();
  const hour = now.getHours();
  const day  = now.getDay(); // 0=So

  const isWeekend = (day === 0 || day === 6);
  const cfg = isWeekend ? CONFIG.warnTimes.weekend : CONFIG.warnTimes.weekday;

  return hour >= cfg.start && hour < cfg.end;
}

/* ==========================================================
   DRUCKSTATUS
   ========================================================== */

function isPrinting() {
  return getState('klipper-moonraker.0.print_stats.state')?.val === 'printing';
}

/* ==========================================================
   SPOOLMAN DB LESEN
   ========================================================== */

function readSpoolman(callback) {
  const cmd = `
ssh ${CONFIG.spoolman.sshHost} "sqlite3 -json ${CONFIG.spoolman.dbPath} '
SELECT
  spool.id AS spool_id,
  filament.name AS name,
  filament.material AS material,
  ROUND(spool.initial_weight - spool.used_weight, 1) AS remaining
FROM spool
JOIN filament ON filament.id = spool.filament_id
WHERE spool.archived IS NOT 1;
'"
`;

  exec(cmd, (err, stdout) => {
    if (err) {
      log(`Spoolman SSH Fehler: ${err.message}`, 'error');
      callback([]);
      return;
    }

    try {
      callback(JSON.parse(stdout));
    } catch {
      log('Spoolman JSON ungültig', 'error');
      callback([]);
    }
  });
}

/* ==========================================================
   STATUS HELFER
   ========================================================== */

function getStatus(remaining) {
  if (remaining < CONFIG.limits.empty) return 'LEER';
  if (remaining < CONFIG.limits.warn)  return 'WARN';
  return 'OK';
}

/* ==========================================================
   HAUPTLOGIK
   ========================================================== */

function update() {

  // globale VIS-States
  ensureState(`${CONFIG.baseState}.warnzeit_aktiv`, isInWarnTime(), 'boolean');
  ensureState(`${CONFIG.baseState}.druck_laeuft`, isPrinting(), 'boolean');

  readSpoolman(spools => {

    CONFIG.extruders.forEach((ext, index) => {

      const slot = `${CONFIG.baseState}.aktiv.${index + 1}`;
      const spoolId = getState(ext.state)?.val;

      if (!spoolId || spoolId <= 0) {
        ensureState(`${slot}.active`, false, 'boolean');
        return;
      }

      const spool = spools.find(s => s.spool_id == spoolId);
      if (!spool) {
        log(`Spule ${spoolId} nicht in Spoolman gefunden`, 'warn');
        return;
      }

      /* Basisdaten */
      ensureState(`${slot}.active`, true, 'boolean');
      ensureState(`${slot}.extruder`, ext.name, 'string');
      ensureState(`${slot}.spool_id`, spoolId, 'number');
      ensureState(`${slot}.name`, spool.name, 'string');
      ensureState(`${slot}.material`, spool.material, 'string');
      ensureState(`${slot}.remaining_weight`, spool.remaining, 'number');

      /* Status */
      const status = getStatus(spool.remaining);
      ensureState(`${slot}.status`, status, 'string');

      const warnId  = `${slot}.warnung`;
      const alarmId = `${slot}.alarm`;

      const warned  = getState(warnId)?.val || false;
      const alarmed = getState(alarmId)?.val || false;

      /* 🟡 WARN */
      if (
        status === 'WARN' &&
        !warned &&
        isInWarnTime() &&
        isPrinting()
      ) {
        sendTo('telegram', 'send', {
          text:
`🟡 Filament wird knapp

🖨 Extruder: ${ext.name}
🧵 ${spool.name}
🎨 ${spool.material}
📦 Rest: ${spool.remaining} g`
        });
        ensureState(warnId, true, 'boolean');
      }

      /* 🔴 LEER */
      if (
        status === 'LEER' &&
        !alarmed &&
        isPrinting()
      ) {
        sendTo('telegram', 'send', {
          text:
`🔴 Filament leer!

🖨 Extruder: ${ext.name}
🧵 ${spool.name}
🎨 ${spool.material}
📦 Rest: ${spool.remaining} g

⚠️ Filament wechseln!`
        });
        ensureState(alarmId, true, 'boolean');
      }

      /* Reset */
      if (status === 'OK') {
        ensureState(warnId, false, 'boolean');
        ensureState(alarmId, false, 'boolean');
      }
    });
  });
}

/* ==========================================================
   SCHEDULER
   ========================================================== */

schedule(CONFIG.schedule, update);
update();
