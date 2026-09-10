/**
 * ============================================================
 * Spoolman – Snapmaker U1 / PAXx / AFC
 * ioBroker JavaScript
 * ============================================================
 *
 * Version: 1.0.0
 *
 * Copyright (c) 2026
 *
 * ============================================================
 *
 * FUNKTIONEN
 *
 * - Liest aktive Spulen aus den AFC Lanes E0–E3
 * - Unterstützt bis zu 4 aktive Spulen
 * - Liest Spool-ID aus dem klipper-moonraker Adapter
 * - Liest Restfilament aus der Spoolman SQLite-Datenbank
 * - Erstellt alle benötigten ioBroker States automatisch
 *
 * - 🟢 OK    >= 300 g
 * - 🟡 WARN  < 300 g
 * - 🔴 LEER  < 100 g
 *
 * - Telegram Vorwarnung
 * - Telegram Leer-Alarm
 * - Warnzeitfenster Wochentag
 * - Warnzeitfenster Wochenende
 * - Warnungen nur während eines Drucks
 *
 * - Sofortige Erkennung eines Spulenwechsels
 * - Regelmäßige Aktualisierung alle 5 Minuten
 * - Schutz gegen parallele SSH-Abfragen
 *
 * ============================================================
 *
 * GETESTETE UMGEBUNG
 *
 * - Snapmaker U1
 * - PAXx v1.6.0-paxx12-22
 * - Spoolman v0.26.1
 * - ioBroker
 * - klipper-moonraker Adapter
 *
 * ============================================================
 */

const { exec } = require('child_process');


/* ================= KONFIGURATION ================= */


const SSH_HOST = 'root@10.0.1.148';

const DB_PATH =
    '/root/.local/share/spoolman/spoolman.db';


const BASE =
    '0_userdata.0.3DDrucker.Spoolman';


const TELEGRAM_INSTANCE =
    'telegram';


/* ================= GRENZWERTE ================= */


const WARN_LIMIT = 300;   // 🟡 unter 300 g

const EMPTY_LIMIT = 100;  // 🔴 unter 100 g


/* ================= WARNZEITEN ================= */


/*
 * Montag bis Freitag
 */

const WARN_START_WEEKDAY = 7;
const WARN_END_WEEKDAY   = 22;


/*
 * Samstag und Sonntag
 */

const WARN_START_WEEKEND = 10;
const WARN_END_WEEKEND   = 20;


/* ================= AFC / EXTRUDER ================= */


/*
 *
 * WICHTIG
 *
 * Dies sind die tatsächlichen Datenpunkte
 * deines klipper-moonraker Adapters.
 *
 *
 * T0 → E0
 * T1 → E1
 * T2 → E2
 * T3 → E3
 *
 */


const EXTRUDERS = [

    {
        name: 'T0',
        lane: 'E0',
        state:
            'klipper-moonraker.0.AFC_lane E0.spool_id'
    },

    {
        name: 'T1',
        lane: 'E1',
        state:
            'klipper-moonraker.0.AFC_lane E1.spool_id'
    },

    {
        name: 'T2',
        lane: 'E2',
        state:
            'klipper-moonraker.0.AFC_lane E2.spool_id'
    },

    {
        name: 'T3',
        lane: 'E3',
        state:
            'klipper-moonraker.0.AFC_lane E3.spool_id'
    }

];


/* ================= UPDATE STEUERUNG ================= */


let updateRunning = false;

let updatePending = false;


/* ================= STATE HELFER ================= */


/*
 * State automatisch erstellen
 */


function ensureState(id, val, type) {


    if (!existsState(id)) {


        createState(

            id,

            val,

            {
                type: type,
                read: true,
                write: false,
                role: 'value'
            }

        );


    } else {


        setState(

            id,

            val,

            true

        );


    }


}


/* ================= ZEITFENSTER ================= */


function inWarnTime() {


    const now = new Date();

    const hour = now.getHours();

    const day = now.getDay();


    /*
     * JavaScript:
     *
     * 0 = Sonntag
     * 1 = Montag
     * 2 = Dienstag
     * 3 = Mittwoch
     * 4 = Donnerstag
     * 5 = Freitag
     * 6 = Samstag
     *
     */


    const isWeekend =

        day === 0 ||

        day === 6;


    /*
     * Wochenende
     */


    if (isWeekend) {


        return (

            hour >= WARN_START_WEEKEND

            &&

            hour < WARN_END_WEEKEND

        );


    }


    /*
     * Montag bis Freitag
     */


    return (

        hour >= WARN_START_WEEKDAY

        &&

        hour < WARN_END_WEEKDAY

    );


}


/* ================= DRUCKSTATUS ================= */


function isPrinting() {


    const state = getState(

        'klipper-moonraker.0.print_stats.state'

    )?.val;


    return state === 'printing';


}


/* ================= SPOOLMAN DB ================= */


/*
 *
 * Liest alle aktiven Spulen
 * aus der Spoolman SQLite Datenbank.
 *
 */


function readSpoolman(callback) {


    const cmd = `ssh ${SSH_HOST} "sqlite3 -json ${DB_PATH} '
SELECT

    spool.id AS spool_id,

    filament.name AS name,

    filament.material AS material,

    spool.initial_weight AS initial_weight,

    spool.used_weight AS used_weight,

    ROUND(
        spool.initial_weight -
        spool.used_weight,
        1
    ) AS remaining

FROM spool

JOIN filament

ON filament.id = spool.filament_id

WHERE spool.archived IS NOT 1;
'"`;


    exec(

        cmd,

        (err, stdout, stderr) => {


            if (err) {


                log(

                    'Spoolman Fehler: '

                    +

                    err.message,

                    'error'

                );


                if (stderr) {


                    log(

                        stderr,

                        'error'

                    );


                }


                callback([]);

                return;


            }


            if (!stdout || !stdout.trim()) {


                log(

                    'Spoolman liefert keine Daten',

                    'warn'

                );


                callback([]);

                return;


            }


            try {


                const data =

                    JSON.parse(stdout);


                callback(data);


            }


            catch (e) {


                log(

                    'Spoolman JSON ungültig: '

                    +

                    e.message,

                    'error'

                );


                callback([]);


            }


        }

    );


}


/* ================= SLOT ZURÜCKSETZEN ================= */


function clearSlot(slot) {


    ensureState(

        `${slot}.active`,

        false,

        'boolean'

    );


    ensureState(

        `${slot}.extruder`,

        '',

        'string'

    );


    ensureState(

        `${slot}.lane`,

        '',

        'string'

    );


    ensureState(

        `${slot}.spool_id`,

        0,

        'number'

    );


    ensureState(

        `${slot}.name`,

        '',

        'string'

    );


    ensureState(

        `${slot}.material`,

        '',

        'string'

    );


    ensureState(

        `${slot}.initial_weight`,

        0,

        'number'

    );


    ensureState(

        `${slot}.used_weight`,

        0,

        'number'

    );


    ensureState(

        `${slot}.remaining_weight`,

        0,

        'number'

    );


    ensureState(

        `${slot}.status`,

        'INAKTIV',

        'string'

    );


    ensureState(

        `${slot}.warnung`,

        false,

        'boolean'

    );


    ensureState(

        `${slot}.alarm`,

        false,

        'boolean'

    );


}


/* ================= HAUPTUPDATE ================= */


function update() {


    /*
     * Schutz gegen parallele Updates
     */


    if (updateRunning) {


        updatePending = true;

        return;


    }


    updateRunning = true;


    /*
     * Globale VIS States
     */


    ensureState(

        `${BASE}.warnzeit_aktiv`,

        inWarnTime(),

        'boolean'

    );


    ensureState(

        `${BASE}.druck_laeuft`,

        isPrinting(),

        'boolean'

    );


    /*
     * Spoolman Daten laden
     */


    readSpoolman(


        spools => {


            /*
             * Sicherheitsprüfung
             */


            if (!Array.isArray(spools)) {


                log(

                    'Keine gültigen Spoolman Daten',

                    'error'

                );


                updateRunning = false;

                return;


            }


            /*
             * Alle AFC Lanes prüfen
             */


            EXTRUDERS.forEach(


                (ext, index) => {


                    const slot =

                        `${BASE}.aktiv.${index + 1}`;


                    /*
                     *
                     * Spool-ID direkt aus AFC Lane
                     *
                     */


                    const spoolId =

                        getState(

                            ext.state

                        )?.val;


                    /*
                     *
                     * Keine Spule aktiv
                     *
                     */


                    if (

                        spoolId === null ||

                        spoolId === undefined ||

                        spoolId === '' ||

                        Number(spoolId) <= 0

                    ) {


                        clearSlot(slot);

                        return;


                    }


                    const spoolIdNumber =

                        Number(spoolId);


                    /*
                     *
                     * Spule in Spoolman suchen
                     *
                     */


                    const spool =

                        spools.find(


                            s =>

                                Number(s.spool_id)

                                ===

                                spoolIdNumber


                        );


                    /*
                     *
                     * Spule nicht gefunden
                     *
                     */


                    if (!spool) {


                        log(

                            `Spule ${spoolIdNumber} ` +

                            `für ${ext.name} / ${ext.lane} ` +

                            `nicht in Spoolman gefunden`,

                            'warn'

                        );


                        clearSlot(slot);

                        return;


                    }


                    /* ================= SPULENWECHSEL ================= */


                    const oldSpoolId =

                        getState(

                            `${slot}.spool_id`

                        )?.val;


                    if (

                        Number(oldSpoolId) > 0

                        &&

                        Number(oldSpoolId)

                        !==

                        spoolIdNumber

                    ) {


                        /*
                         *
                         * Neue Spule
                         *
                         * Warnungen zurücksetzen
                         *
                         */


                        ensureState(

                            `${slot}.warnung`,

                            false,

                            'boolean'

                        );


                        ensureState(

                            `${slot}.alarm`,

                            false,

                            'boolean'

                        );


                        log(

                            `Neue Spule erkannt: ` +

                            `${ext.name} / ${ext.lane} ` +

                            `Spool ID ${oldSpoolId} → ${spoolIdNumber}`,

                            'info'

                        );


                    }


                    /* ================= BASISDATEN ================= */


                    ensureState(

                        `${slot}.active`,

                        true,

                        'boolean'

                    );


                    ensureState(

                        `${slot}.extruder`,

                        ext.name,

                        'string'

                    );


                    ensureState(

                        `${slot}.lane`,

                        ext.lane,

                        'string'

                    );


                    ensureState(

                        `${slot}.spool_id`,

                        spoolIdNumber,

                        'number'

                    );


                    ensureState(

                        `${slot}.name`,

                        spool.name || '',

                        'string'

                    );


                    ensureState(

                        `${slot}.material`,

                        spool.material || '',

                        'string'

                    );


                    ensureState(

                        `${slot}.initial_weight`,

                        Number(spool.initial_weight) || 0,

                        'number'

                    );


                    ensureState(

                        `${slot}.used_weight`,

                        Number(spool.used_weight) || 0,

                        'number'

                    );


                    ensureState(

                        `${slot}.remaining_weight`,

                        Number(spool.remaining) || 0,

                        'number'

                    );


                    /* ================= STATUS ================= */


                    const remaining =

                        Number(spool.remaining);


                    let status = 'OK';


                    /*
                     * 🔴 LEER
                     */


                    if (remaining < EMPTY_LIMIT) {


                        status = 'LEER';


                    }


                    /*
                     * 🟡 WARN
                     */


                    else if (remaining < WARN_LIMIT) {


                        status = 'WARN';


                    }


                    /*
                     * 🟢 OK
                     */


                    else {


                        status = 'OK';


                    }


                    ensureState(

                        `${slot}.status`,

                        status,

                        'string'

                    );


                    /* ================= WARNSTATUS ================= */


                    const warnId =

                        `${slot}.warnung`;


                    const alarmId =

                        `${slot}.alarm`;


                    const alreadyWarned =

                        getState(warnId)?.val || false;


                    const alreadyAlarmed =

                        getState(alarmId)?.val || false;


                    /* ================= 🟡 WARNUNG ================= */


                    if (

                        status === 'WARN'

                        &&

                        !alreadyWarned

                        &&

                        inWarnTime()

                        &&

                        isPrinting()

                    ) {


                        sendTo(

                            TELEGRAM_INSTANCE,

                            'send',

                            {


                                text:

`🟡 Filament wird knapp

🖨 Snapmaker U1

🔧 Tool: ${ext.name}
🔌 AFC Lane: ${ext.lane}

🧵 Farbe: ${spool.name}
📦 Material: ${spool.material}

⚖️ Restfilament:
${remaining} g

⚠️ Bitte Filamentwechsel vorbereiten.`


                            }

                        );


                        ensureState(

                            warnId,

                            true,

                            'boolean'

                        );


                        log(

                            `🟡 WARNUNG ${ext.name}: ${remaining} g`,

                            'info'

                        );


                    }


                    /* ================= 🔴 LEER ================= */


                    if (

                        status === 'LEER'

                        &&

                        !alreadyAlarmed

                        &&

                        isPrinting()

                    ) {


                        sendTo(

                            TELEGRAM_INSTANCE,

                            'send',

                            {


                                text:

`🔴 FILAMENT FAST LEER!

🖨 Snapmaker U1

🔧 Tool: ${ext.name}
🔌 AFC Lane: ${ext.lane}

🧵 Farbe: ${spool.name}
📦 Material: ${spool.material}

⚖️ Restfilament:
${remaining} g

🚨 FILAMENT WECHSELN!`


                            }

                        );


                        ensureState(

                            alarmId,

                            true,

                            'boolean'

                        );


                        log(

                            `🔴 ALARM ${ext.name}: ${remaining} g`,

                            'warn'

                        );


                    }


                    /* ================= RESET ================= */


                    /*
                     *
                     * Spule wieder ausreichend gefüllt
                     *
                     */


                    if (remaining >= WARN_LIMIT) {


                        ensureState(

                            warnId,

                            false,

                            'boolean'

                        );


                        ensureState(

                            alarmId,

                            false,

                            'boolean'

                        );


                    }


                }

            );


            /*
             *
             * Update abgeschlossen
             *
             */


            updateRunning = false;


            /*
             *
             * Neues Update während laufendem
             * Update angefordert?
             *
             */


            if (updatePending) {


                updatePending = false;


                setTimeout(

                    () => update(),

                    500

                );


            }


        }

    );


}


/* ============================================================
 *
 * SOFORTIGE SPULENWECHSEL-ERKENNUNG
 *
 * ============================================================
 *
 * Überwacht:
 *
 * klipper-moonraker.0.AFC_lane E0.spool_id
 * klipper-moonraker.0.AFC_lane E1.spool_id
 * klipper-moonraker.0.AFC_lane E2.spool_id
 * klipper-moonraker.0.AFC_lane E3.spool_id
 *
 * ============================================================
 */


EXTRUDERS.forEach(


    ext => {


        on(

            {

                id: ext.state,

                change: 'ne'

            },


            obj => {


                log(

                    `AFC Änderung erkannt: ` +

                    `${ext.name} / ${ext.lane} ` +

                    `→ neue Spool-ID: ${obj.state.val}`,

                    'info'

                );


                /*
                 *
                 * 1 Sekunde warten
                 *
                 * Damit alle Klipper/PAXx Daten
                 * vollständig aktualisiert sind.
                 *
                 */


                setTimeout(


                    () => {


                        update();


                    },


                    1000


                );


            }

        );


    }

);


/* ============================================================
 *
 * REGELMÄSSIGE AKTUALISIERUNG
 *
 * ============================================================
 *
 * Alle 5 Minuten:
 *
 * - Spoolman Restgewicht aktualisieren
 * - Status aktualisieren
 * - Warnungen prüfen
 *
 * ============================================================
 */


schedule(

    '*/5 * * * *',

    () => {


        update();


    }

);


/* ============================================================
 *
 * SCRIPT START
 *
 * ============================================================
 */


log(

    'Spoolman Snapmaker U1 Script v1.0.0 gestartet',

    'info'

);


/*
 *
 * Sofort aktualisieren
 *
 */


update();
