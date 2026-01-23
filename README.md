
# 🧵 ioBroker – Klipper – Spoolman Integration

Verbindet **Klipper / Moonraker**, **Spoolman** und **ioBroker** zu einem
vollautomatischen Filament-Monitoring-System mit:

- 🟢🟡🔴 Ampel-Status je aktiver Spule  
- 📊 VIS-Visualisierung  
- 🔔 Telegram-Warnungen  
- 🧠 Druck- & Zeitfenster-Logik  

---

## ✨ Features

- Unterstützung für **bis zu 4 Extruder / Spulen**
- Spool-ID direkt aus **Klipper / Moonraker**
- Restfilament-Berechnung über **Spoolman**
- Automatische State-Erstellung in ioBroker
- Telegram:
  - 🟡 Vorwarnung (z. B. < 300 g)
  - 🔴 Leer-Alarm (z. B. < 100 g)
- Warnungen **nur wenn Druck läuft**
- Zeitfenster:
  - Werktag / Wochenende getrennt
- VIS-freundliche Struktur

---

## 📦 Architektur

```text
Klipper GUI
   ↓ (Spool-ID)
Moonraker Adapter
   ↓
ioBroker JavaScript
   ↓ (SSH)
Spoolman SQLite
```
---
## ⚠️ Wichtig:
Klipper schreibt Filamentverbrauch nach Spoolman.
Spoolman berechnet die Restmenge.
ioBroker liest nur aus.
