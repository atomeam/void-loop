# Fyta Domain Knowledge

**Goal:** Make Verse fully immersed in Fyta so it can help with plant care, sensor data interpretation, troubleshooting, recommendations, and any related tasks.

## What is Fyta?
Fyta (fyta.de) is a Berlin-based company that builds smart plant sensors and an AI-powered app for plant care. Their core product line measures real-time plant health data so users stop guessing and start tracking.

### Core Products
- **FYTA Beam** – Main soil sensor that measures:
  - Soil moisture (VWC)
  - Nutrients / electrical conductivity (EC)
  - Light (PPFD / DLI)
  - Temperature
  - Humidity
- **FYTA Mini, Sphere, Terra** – Additional modular sensors for different setups (indoor, outdoor, hydroponics, larger plants, etc.)

### How it works
1. Stick the sensor into the soil (or appropriate medium).
2. Pair with the free Fyta app (iOS / Android).
3. The app uses AI + a large plant database (thousands of species) to give personalized care advice:
   - When to water
   - When to fertilize
   - Light adjustments
   - Repotting needs
   - Alerts and vacation mode

### Key Strengths Verse should know
- Data-driven instead of guesswork
- Species-specific recommendations
- Works for houseplants, herbs, outdoor plants, and more
- Modular system so users can mix sensors
- Strong focus on making plant care accessible and sustainable

### How Verse can help (immersed assistance)
- Interpret sensor readings and translate them into plain-language actions
- Suggest which Fyta sensor fits a user’s plants / environment
- Create custom care schedules
- Troubleshoot common problems (overwatering, nutrient deficiency, light issues)
- Recommend plants that match a user’s light / humidity conditions
- Track long-term plant health trends if the user shares data
- Generate planting / care guides in the same Prima/Brady style we use for games
- Help with vacation mode planning or sharing plant duties

### Related Concepts Verse should connect
- Soil science basics (VWC, EC, pH)
- Photosynthetically Active Radiation (PAR / PPFD / DLI)
- Common houseplant species and their needs
- Hydroponics vs soil
- Sustainable indoor gardening

## Implementation Notes for Verse
- Treat Fyta as a first-class domain alongside games, trophies, and guides.
- When a user mentions plants, sensors, watering, or Fyta, route to this knowledge.
- Prefer actionable, data-backed advice over generic plant tips.
- Keep learning: if the user shares specific sensor readings or plant species, update local context and improve future responses.

Verse is now expected to become immersed in Fyta and help in any way it can.
