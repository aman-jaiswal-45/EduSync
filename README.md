# EduSync — Cross-Iframe Bidirectional Sync Workspace

EduSync is a premium, high-fidelity bidirectional rich-text editor synchronizer designed specifically for the **Engineering Intern** assessment at **EduChunks**. It enables two isolated iframes to communicate real-time formatting, keystrokes, and undo/redo histories through a central host broker, all while preserving the caret cursor position during active edits.

---

## 🚀 Quick Start (How to Run)
1. Clone or download this project folder on your local machine.
2. Double-click **`index.html`** to open it directly in any modern web browser (no installation or bundlers required).
3. Type in either editor, highlight text to apply formatting, or trigger undo operations. Telemetry events will stream live into the bottom console.

---

## ✨ Features Implemented

### 1. Core Requirements
*   **Dual Editor Canvas:** Two separate iframes, each running isolated browser document sessions, displaying distinct primary/replica labels.
*   **Bidirectional Sync:** Editing formatting (Bold, Italic, Strikethrough, Underline, Bullet Lists) in one editor updates the replica workspace instantly.
*   **postMessage Broker:** A secure event broker hosted on the main page that receives updates, handles logging, and forwards messages.
*   **Infinite Loop Protection:** An event guard flag (`isApplyingSync`) stops receiving editors from echo-broadcasting programmatic changes back to the host.

### 2. Nice-to-Haves
*   **Origin validation:** Enforces security by checking `event.origin` in the message handler. Can be toggled on/off via the **Secure Lock** switch on the console header.
*   **Dynamic Toolbar Button States:** Listens to `selectionchange` and evaluates the formatting state under the text cursor using `document.queryCommandState()` to toggle active highlights on the floating pill docks.
*   **Visual Sync Flash Vignettes:** Updates trigger an immersive border vignette and background sweep animation (Cyan glow for Frame A, Amber glow for Frame B) to indicate a sync.

### 3. Bonus Challenges
*   **Text Input Sync:** Keeps typed content updated character-by-character in real-time as you type, rather than waiting for an blur or change event.
*   **Cursor Position Preservation:** Overwriting `innerHTML` resets the selection range. EduSync maps the caret selection to a character-based offset before transmitting and walks the text nodes of the new DOM tree recursively to restore the cursor selection dynamically.
*   **Undo/Redo History Sync:** Custom debounced history manager caches states inside each editor. Pressing `Ctrl+Z` / `Ctrl+Y` or clicking toolbar arrows synchronization moves both frames in lockstep.
*   **Live Event Log Console:** Renders macOS-style event logs detailing the source, destination, timestamp, and collapsible raw HTML payload.

### 4. Creative Product Enhancement (EduChunks Special) 🔊
*   **Text-to-Speech (TTS) Reader:** Implements the Web Speech Synthesis API inside each editor toolbar pill. Highlight any sentence (or leave empty) and click `🔊 Speak` to hear it read out in narration mode, aligning with EduChunks' document-to-playlist core product.
*   **Dynamic Font Family Selector:** Features a drop-down menu containing 5 distinct premium typography styles (*Outfit*, *Fira Code*, *Georgia*, *Playfair Display*, *Merriweather*). Font selections update the other iframe workspace in real-time, matching standard styling sync.

---

## 🛠️ Architecture & Core Algorithms

```
[Iframe Alpha]  --(postMessage)-->  [Host Broker]  --(Relay)-->  [Iframe Beta]
 (Cyan Cursor)                      (Console Log)               (Amber Cursor)
```

### Caret Preservation Algorithmic Logic
The cursor mapping algorithm in `editor.js` handles text formatting boundary intersections (e.g. typing inside `<strong>` tags):
1.  **Selection Capture:**
    ```javascript
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preCaretRange.toString().length;
    ```
2.  **DOM Node Traversal:** Upon drawing the new HTML markup, a recursive DOM Tree Walker traverses the new text nodes to aggregate characters. When the character tally matches the cached offset, it injects the caret selection range back into that text node container.

---

## 📍 Candidate Interview Q&A

*(Answers to questions sent by Vinaya Babu)*

### 🏢 Bangalore In-person Availability
*   **Are you available to work from our Bangalore office (in-person / offline)?**
    > **Yes**, I am fully available to work in-person from the Bangalore office.
*   **Which days or schedule works best for you?**
    > **Monday to Friday** works best, matching standard business hours.

### 🎓 College Commitment
*   **Are you currently enrolled in a degree program?**
    > **Yes**, I am currently enrolled in a degree program.
*   **How many months can you commit to working with us without college commitments?**
    > I can commit to a full-time in-person internship for **6 months** (or insert your own duration) starting immediately.

---

## 📁 Project File Map
*   `index.html` - Dashboard host console, frame broker, and Mac log terminal.
*   `host.css` - Custom styling for space canvas grids, status panels, and drawer consoles.
*   `editor.html` - Reusable editor iframe template featuring floating toolbar docks.
*   `editor.css` - Styles text carets, active selection tabs, and the cyan/amber sync flashes.
*   `editor.js` - Logic mapping toolbar controls, DOM Caret offsets, TTS synthesis, and history buffers.
