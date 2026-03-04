---
title: "The Wave - Innovation Journey"
description: "A mobile-first web app guiding users through a 5-step innovation process using BLE scanning or manual selection."
version: "1.0.0"
---

# The Wave - Innovation Journey

## Overview

The Wave is an interactive, mobile-first web application designed to guide users through a 5-step journey of discovery and innovation. It provides an engaging interface with "scanning" functionality to navigate physical or conceptual steps in the journey.

## Features

- **Location Scanning via BLE:** Connect physical paths to digital content using Bluetooth Low Energy (BLE).
- **Manual Location Selection:** A fallback mechanism allowing users to manually pick their current step if scanning is unavailable.
- **Interactive Journey Interface:** Step-by-step progress tracking for a seamless user experience.
- **Dynamic Topographical UI:** Modern design featuring animated footprint paths, glassmorphism cards, and responsive layouts.
- **Completion Summary:** A concluding view that summarizes the journey once all five stages have been discovered.

## Architecture

This project utilizes a lightweight vanilla frontend architecture without heavy frameworks, prioritizing speed, native browser APIs, and responsiveness.

### Core Technologies

- **HTML5:** Semantic structure and layout.
- **CSS3:** Custom styles, dynamic variables, and keyframe animations (`styles.css`, `animations.css`).
- **Vanilla JavaScript:** 
  - Routing and UI state management (`app.js`, `locations.js`, `scanning.js`)
  - Configuration (`wave-config.js`, `config.js`)
  - BLE Integration (`ble.js`)

### Directory Structure

The repository is structured to separate concerns while maintaining a flat build:
- `/css`: Stylesheets and animations.
- `/js`: Specialized JavaScript modules.
- `/assets` / `/photos`: Static images and localized media.

## Setup and Usage

To run the application locally, it is highly recommended to use a local web server to prevent CORS issues and accurately test the secure-context features (such as Web Bluetooth).

### Running Locally

1. Open a terminal and navigate to the project root directory.
2. Start a local server (e.g., via Python):
   ```bash
   python3 -m http.server 8000
   ```
3. Visit `http://localhost:8000` in your supported web browser.

### Device Requirements

- The web application is optimized for mobile views with strict viewport dimensions matching native app experiences.
- A modern browser with "Web Bluetooth API" support is required to use the scanning functionality (Chrome, Edge, or compatible browsers on Android/macOS/Windows; requires workarounds for iOS).
