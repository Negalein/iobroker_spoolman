# ioBroker Spoolman Integration v2.0.0

[![Version](https://img.shields.io/badge/version-2.0.0-brightgreen)] [![License](https://img.shields.io/badge/license-MIT-blue.svg)] [![ioBroker](https://img.shields.io/badge/ioBroker-compatible-yellow)]

**Automatische Filamentüberwachung für Klipper/Spoolman** 🧵🖨️

Liest aktive Spulen aus Moonraker, holt Restmengen aus Spoolman (SSH/SQLite) und warnt per Telegram bei Knappheit oder Leerung. **VIS-ready States + Ampel-Logik.**

Neu in 

**🖨️ Spoolman Monitor für Snapmaker U1 / PAXx / ioBroker**

Überwache die aktiven Filamentspulen deines Snapmaker U1 mit Spoolman, PAXx, Klipper/Moonraker und ioBroker.

Das Script erkennt automatisch bis zu 4 aktive AFC-Lanes, liest die jeweilige Spool-ID aus dem klipper-moonraker Adapter, ermittelt das Restgewicht direkt aus der Spoolman-Datenbank und stellt alle Informationen als ioBroker-Datenpunkte für VIS, Automatisierungen und Telegram-Warnungen bereit.

✨ Funktionen
🖨️ Unterstützung für Snapmaker U1
🔄 Unterstützung für PAXx / AFC
🧵 Überwachung von bis zu 4 Spulen gleichzeitig
🔍 Automatisches Auslesen der aktiven Spool-ID
📦 Restfilament direkt aus Spoolman
🟢🟡🔴 Automatische Statusbewertung
🔔 Telegram-Vorwarnung bei niedrigem Filamentbestand
🚨 Telegram-Alarm bei fast leerem Filament
🕒 Konfigurierbare Warnzeiten
📅 Unterschiedliche Warnzeiten für Wochentage und Wochenende
🖨️ Warnungen nur während eines aktiven Drucks
🔄 Sofortige Erkennung eines Spulenwechsels
⏱️ Automatische Aktualisierung alle 5 Minuten
🧠 Automatische Erstellung aller benötigten ioBroker-Datenpunkte
🛡️ Schutz vor parallelen Updates
📊 Perfekte Grundlage für eine VIS-Ansicht

## ✨ Features

| Feature | Status |
|---------|--------|
| 🟢 Live Restmengen aller Spulen | ✅ |
| 🟢 Ampel-Status (OK/WARN/LEER/NONE) | ✅ |
| 🟢 Telegram-Warnungen Zeit-/Druckgesteuert | ✅ |
| 🟢 Automatische ioBroker States | ✅ |
| 🟢 Multi-Extruder Support T0-T3 | ✅ |
| 🔧 "Spule null" Fix (v2.0.0) | ✅ |

## 🚀 Quickstart (5 Minuten)

1. **Skript kopieren** → ioBroker → Skripte → Neues Skript → "3D-Drucker.Spoolman_JS"
2. **CONFIG anpassen** (SSH-IP, baseState Pfad)
3. **Telegram Adapter** aktivieren
4. **Skript starten** ✅

## 📋 Voraussetzungen

| Komponente | Version | Zweck |
|------------|---------|-------|
| ioBroker | 5.x+ | Plattform |
| Klipper Moonraker Adapter | latest | Spool-ID lesen |
| Telegram Adapter | latest | Benachrichtigungen |
| SSH-Zugang | Spoolman Server | DB-Abfrage |

## ⚙️ Konfiguration

```
const CONFIG = {
    spoolman: {
        sshHost: 'root@10.0.1.148',  // ← Deine IP!
        dbPath: '/root/.local/share/spoolman/spoolman.db'
    },
    baseState: '0_userdata.0.3DDrucker.Spoolman',  // ← Dein Pfad!
    limits: { warn: 300, empty: 100 },  // Gramm
    warnTimes: {
        weekday: { start: 7, end: 22 },
        weekend: { start: 10, end: 20 }
    },
    schedule: '*/5 * * * *'  // Alle 5 Minuten
};
```

📊 States Struktur (automatisch)


```
0_userdata.0.3DDrucker.Spoolman/
├── warnzeit_aktiv (boolean)
├── druck_laeuft (boolean)
├── aktiv.1/    [T0]
│   ├── active (boolean)
│   ├── extruder → "T0"
│   ├── spool_id (number)
│   ├── name → "PLA Testspule"
│   ├── material → "PLA"
│   ├── remaining_weight → 280
│   ├── status → OK|WARN|LEER|NONE|MISSING
│   ├── warnung (boolean)
│   ├── alarm (boolean)
│   └── last_message → "WARN"
├── aktiv.2/ [T1]
├── aktiv.3/ [T2]
└── aktiv.4/ [T3]
```

🎨 VIS Farben

```
{
  "datapath": "0_userdata.0.3DDrucker.Spoolman.aktiv.*.status",
  "color": {
    "OK": "#00ff00",
    "WARN": "#ffff00",
    "LEER": "#ff0000",
    "NONE": "#808080",
    "MISSING": "#ff8800"
  }
}
```

🔔 Telegram Meldungen
🟡 WARN (unter 300g während Druck):

```
🟡 Filament wird knapp
🖨 Extruder: T0
🧵 PLA Testspule
🎨 PLA
📦 Rest: 280 g
```

🔴 ALARM (unter 100g während Druck):

```
🔴 Filament leer!
🖨 Extruder: T0
🧵 PLA Testspule
📦 Rest: 85 g
⚠️ Filament wechseln!
```

🔍 Troubleshooting

| Problem | Lösung |
|---------|--------|
| Spule null nicht gefunden | ✅ v2.0.0 Fix - Skript aktualisieren |
| Spoolman SSH Fehler | SSH-Key ohne Passwort einrichten |
| Keine States | baseState Pfad prüfen |
| Keine Telegram | Telegram Bot Token prüfen |
| Status bleibt NONE | klipper-moonraker.0.gcode_macro T0.spool_id prüfen |

📈 Changelog

| **Version** | **Datum** | **Highlights** |
|---------|--------|--------|
| 2.0.0 | 2026-02-16 | "Spule null" Fix, String→Number, Status NONE/MISSING, Null-Safety |
| 1.0.0 | 2025 | Initial Release |

🤝 Contributing

1. Fork Repository
2. git checkout -b feature/xyz
3. Commit & Push
4. Pull Request

📄 License
**MIT License** © 2026 Negalein (AT)

---

⭐ Star wenn hilfreich!
💬 Issues: github.com/Negalein/iobroker_spoolman/issues
