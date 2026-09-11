# 🛡️ Suraksha Setu (सुरक्षा सेतु)
> Next-Generation Hyper-Local Extreme Weather & Disaster Early Warning Platform

Suraksha Setu is a mission-critical emergency operations, citizen corroboration, and predictive disaster management platform engineered for resilient civic response during urban flooding, cloudbursts, and extreme monsoon events across India.

---

## 🌟 Key Capabilities

- 🚨 **Citizen Hazard Reporting & Live Status Tracking (`/track`)**
  - Instant hazard reporting with GPS coordinates, depth estimation, and photo evidence.
  - Sub-3-second reactive polling: citizens receive real-time visual updates when authorities order evacuations, dispatch dewatering pumps, or clear roads.
  - Ground-truth verification badge (`✓ Verified Genuine` vs `✕ Flagged False Alarm`).
  - Chronological agency action history log with official notes.

- 🏛️ **Meteorologist & Command Console (`/staff/admin`)**
  - **Section 1: Ground Truth Verification (Right / Wrong)**: Meteorologist verification workflow to confirm genuine hazards and reject false alarms before tactical escalation.
  - **Action-Separated Sections**: Organized by first action taken (*Evacuation Ordered*, *Dewatering Dispatched*, *CAP 1.2 Warning Issued*, *Search & Rescue Deployed*, *Sensor Watch*, *Hazard Cleared*) with specific meteorologist recommendations.
  - Direct municipal and emergency tactical action triggers that cascade in real time.

- 🗺️ **High-Precision Multi-Layer Maps (`/map`)**
  - **100% Free Open Data Tiles (Zero Paid API Keys Required)**:
    - 🗺️ **Urban Street Map**: CartoDB Voyager with road lanes, underpass markers, and building footprints.
    - 🛰️ **High-Res Hybrid Satellite**: Esri World Imagery + Esri Reference Boundaries and Places labels.
    - 🌑 **Tactical Dark Radar**: CartoDB Dark Matter with high-contrast emergency overlays.
  - Real ground photographs from major Indian hotspots (Minto Bridge, Hindmata Flyover, Sion, Bellandur, Velachery, Shimla, etc.).
  - Interactive 360° ground street view panoramic viewer with compass azimuth HUD.

- 🔮 **Hydrodynamic & Weather ML Prediction Engine**
  - Multi-hour simulation horizons ($T+1\text{h}$, $T+3\text{h}$, $T+6\text{h}$, $T+12\text{h}$, $T+24\text{h}$) modeling flood crest arrival time ($T_{\text{peak}}$) and water depth curves.
  - Hydrodynamic Rational Method runoff modeling ($Q = C \cdot I \cdot A$) and sump pump balance analysis.
  - Cascading infrastructure vulnerability scoring (substations, rail corridors, ground floors, drinking water).
  - Automated 5-phase prescriptive response plan:
    - **Phase A**: Citizen Safety & Evacuation
    - **Phase B**: Municipal Dewatering & Barriers
    - **Phase C**: Traffic Police Road Diversions
    - **Phase D**: Search & Rescue (NDRF/SDRF)
    - **Phase E**: Power Grid & Recovery Logistics

- 📢 **Standardized Alerting & Multi-Language Support**
  - OASIS Common Alerting Protocol (CAP 1.2 XML) broadcast generator.
  - Full localization in English, Hindi (हिन्दी), Marathi (मराठी), Tamil (தமிழ்), Kannada (ಕನ್ನಡ), and Bengali (বাংলা).

---

## 🚀 Tech Stack

- **Framework**: Next.js 16.3 (App Router, React 19, TypeScript)
- **Maps**: MapLibre GL + OpenStreetMap / CARTO / Esri Open Data
- **Styling**: Pure Modular CSS with dark midnight navy (`#0B1F33`) emergency styling
- **Standards**: OASIS CAP 1.2 XML

---

## 🛠️ Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vishesh1916/suraksha-setu.git
   cd suraksha-setu
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

4. **Build for production**:
   ```bash
   npm run build
   ```

