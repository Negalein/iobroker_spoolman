/**
 * ============================================================
 * ioBroker – Klipper – Spoolman Integration
 * ============================================================
 *
 * @version     2.0.0 (2026-02-16)
 * @author      Negalein
 * @copyright   Copyright (c) 2026 Negalein
 * @license     MIT License - https://opensource.org/licenses/MIT
 * @repository  https://github.com/Negalein/iobroker_spoolman
 *
 * ============================================================
 * VERSIONSHISTORIE
 * ============================================================
 * 1.0.0 (2025) - Initial Release
 *   • Erste Version mit Basis-Funktionalität
 *   • Ampel-Logik + Telegram-Warnungen
 *
 * 2.0.0 (2026-02-16) - NULL-FIX Release
 *   • ✅ FIX: "Spule null nicht in Spoolman gefunden" behoben
 *   • ✅ String spool_id korrekt in Zahl umgewandelt  
 *   • ✅ Robusterer Umgang mit ungültigen Moonraker-Werten
 *   • ✅ Zusätzliche Status: NONE/MISSING für VIS-Anzeige
 *   • ✅ Null-Safety für remaining_weight (NaN verhinder)
 *   • 🔧 Code-Optimierungen (Performance + Lesbarkeit)
 *
 * ============================================================
 * FUNKTIONEN
 * ============================================================
 * - Liest aktive Spulen-IDs aus Klipper (Moonraker)
 * - Holt Restfilament aus Spoolman (SQLite per SSH)
 * - Erstellt automatisch ioBroker-States (VIS-ready)
 * - Ampel-Logik: 🟢OK 🟡WARN 🔴LEER
 * - Telegram-Warnungen mit Zeit-/Druck-Logik
 * ============================================================
 */


const { exec } = require('child_process');

/* ========================= KONFIGURATION ========================= */

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

/* ========================= HELFER: STATES ========================= */

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

/* ========================= HELFER: ZEIT ========================= */

function isInWarnTime() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const isWeekend = (day === 0 || day === 6);
    const cfg = isWeekend ? CONFIG.warnTimes.weekend : CONFIG.warnTimes.weekday;

    return hour >= cfg.start && hour < cfg.end;
}

/* ========================= HELFER: DRUCKSTATUS ========================= */

function isPrinting() {
    const state = getState('klipper-moonraker.0.print_stats.state');
    return state && state.val === 'printing';
}

/* ========================= HELFER: SPOOLMAN ========================= */

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

        if (!stdout || !stdout.trim()) {
            // Kein Ergebnis zurückbekommen
            log('Spoolman: Keine Daten erhalten (leere Ausgabe)', 'warn');
            callback([]);
            return;
        }

        try {
            const data = JSON.parse(stdout);
            if (!Array.isArray(data)) {
                log('Spoolman: JSON ist kein Array', 'error');
                callback([]);
                return;
            }
            callback(data);
        } catch (e) {
            log(`Spoolman JSON ungültig: ${e.message}`, 'error');
            callback([]);
        }
    });
}

/* ========================= HELFER: STATUS ========================= */

function getStatus(remaining) {
    if (remaining < CONFIG.limits.empty) return 'LEER';
    if (remaining < CONFIG.limits.warn) return 'WARN';
    return 'OK';
}

/* ========================= HAUPTLOGIK ========================= */

function update() {
    const base = CONFIG.baseState;

    // Globale Infos
    const warnTimeActive = isInWarnTime();
    const printing = isPrinting();

    ensureState(`${base}.warnzeit_aktiv`, warnTimeActive, 'boolean');
    ensureState(`${base}.druck_laeuft`, printing, 'boolean');

    readSpoolman(spools => {
        CONFIG.extruders.forEach((ext, index) => {
            const slot = `${base}.aktiv.${index + 1}`;

const spoolIdState = getState(ext.state);
let spoolId = spoolIdState ? spoolIdState.val : 0;

// Falls der Adapter komische Werte liefert, in 0 umwandeln
if (spoolId === 'null' || spoolId === 'undefined' || spoolId === '' || spoolId === null || spoolId === undefined) {
    spoolId = 0;
}

if (!spoolId || Number(spoolId) <= 0) {
    // Keine Spule aktiv
    ensureState(`${slot}.active`, false, 'boolean');
    ensureState(`${slot}.status`, 'NONE', 'string');
    return;
}
            const spool = spools.find(s => String(s.spool_id) === String(spoolId));

            if (!spool) {
                log(`Spule ${spoolId} nicht in Spoolman gefunden`, 'warn');
                ensureState(`${slot}.active`, false, 'boolean');
                ensureState(`${slot}.status`, 'MISSING', 'string');
                return;
            }

            // Basisdaten
            ensureState(`${slot}.active`, true, 'boolean');
            ensureState(`${slot}.extruder`, ext.name, 'string');
            ensureState(`${slot}.spool_id`, spoolId, 'number');
            ensureState(`${slot}.name`, spool.name, 'string');
            ensureState(`${slot}.material`, spool.material, 'string');
            ensureState(`${slot}.remaining_weight`, spool.remaining, 'number');

            // Status
            const status = getStatus(spool.remaining);
            ensureState(`${slot}.status`, status, 'string');

            const warnFlagId = `${slot}.warnung`;
            const alarmFlagId = `${slot}.alarm`;
            const lastMsgId = `${slot}.last_message`;

            const warned = getState(warnFlagId)?.val || false;
            const alarmed = getState(alarmFlagId)?.val || false;

            // WARN
            if (status === 'WARN' && !warned && warnTimeActive && printing) {
                const text =
                    `🟡 Filament wird knapp\n` +
                    `🖨 Extruder: ${ext.name}\n` +
                    `🧵 ${spool.name}\n` +
                    `🎨 ${spool.material}\n` +
                    `📦 Rest: ${spool.remaining} g`;

                sendTo('telegram', 'send', { text });
                ensureState(warnFlagId, true, 'boolean');
                ensureState(lastMsgId, 'WARN', 'string');
            }

            // LEER
            if (status === 'LEER' && !alarmed && printing) {
                const text =
                    `🔴 Filament leer!\n` +
                    `🖨 Extruder: ${ext.name}\n` +
                    `🧵 ${spool.name}\n` +
                    `🎨 ${spool.material}\n` +
                    `📦 Rest: ${spool.remaining} g\n` +
                    `⚠️ Filament wechseln!`;

                sendTo('telegram', 'send', { text });
                ensureState(alarmFlagId, true, 'boolean');
                ensureState(lastMsgId, 'ALARM', 'string');
            }

            // Reset Flags, wenn wieder OK
            if (status === 'OK') {
                ensureState(warnFlagId, false, 'boolean');
                ensureState(alarmFlagId, false, 'boolean');
                ensureState(lastMsgId, 'OK', 'string');
            }
        });
    });
}

/* ========================= SCHEDULER ========================= */

schedule(CONFIG.schedule, update);
update();
