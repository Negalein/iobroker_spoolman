# 🧵 ioBroker – Klipper – Spoolman Integration

Automatische Filamentüberwachung für 3D‑Drucker mit Klipper, Spoolman und ioBroker.

---

## Features
- 🟢🟡🔴 Ampelstatus je Spule
- bis zu 4 Extruder
- Restfilament aus Spoolman (SQLite via SSH)
- Telegram Warnungen
- Warnungen nur wenn Druck läuft
- Zeitfenster (Woche / Wochenende)
- VIS‑optimierte States

---

## Architektur
Klipper → Moonraker → ioBroker → SSH → Spoolman

---

## Voraussetzungen
- ioBroker + javascript
- telegram
- klipper-moonraker
- Spoolman
- SSH Zugriff

---

## Wichtige Pfade
Spoolman DB:
/root/.local/share/spoolman/spoolman.db

Klipper Spool IDs:
klipper-moonraker.0.gcode_macro T0.spool_id … T3.spool_id

---

## States
Basis: 0_userdata.0.3DDrucker.Spoolman

### Global
| State | Typ |
|-------|-----|
| warnzeit_aktiv | boolean |
| druck_laeuft | boolean |

### aktiv.X
| State | Typ |
|---------|------|
| active | boolean |
| extruder | string |
| spool_id | number |
| name | string |
| material | string |
| remaining_weight | number |
| status | OK/WARN/LEER |
| warnung | boolean |
| alarm | boolean |

---

## Ampel
- OK ≥ 300g
- WARN < 300g
- LEER < 100g

---

## Version
v1.0.0 – Initial Stable Release

## License
MIT
