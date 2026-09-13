# Ward Callings Board

A board for the bishop's office TV. It shows every ward organization, every calling, who holds it, and how long they've served, with a color code for time in calling. It also has a planning mode for trying out changes, like a new Elders Quorum presidency, before anything happens in LCR.

## ⚠️ Privacy rule: no member data in this repo

This repository is **public** on purpose (see "Why public?" below). That's safe only because it contains **no member information**:

- LCR exports are imported **in the browser** and saved only in that browser's local storage. They're never uploaded.
- Put exports in the `private/` folder. It's git-ignored, as are `*.csv`, `*.xlsx`, and backup files.
- The demo data (`src/import/demo.ts`) uses fictional names only.
- **Before every commit, check `git status` for anything that looks like a report or backup.** If you ever commit member data by accident, tell the other clerk right away. Deleting it in a later commit doesn't remove it from history.

## Using it

1. Open the site (Vercel URL) on the laptop connected to the TV.
2. **Import:** LCR shows these reports only as PDFs, and the board reads the PDFs directly, in the browser.
   - In LCR, open the report, click **Print**, and save the PDF into `private/` (or anywhere off GitHub).
   - Click **Import** and drop each PDF into its box.

   The two reports are:
   - **Members with Callings**
   - A **member list** (Name, Gender, Age). This is how the board knows who has no calling.

   The importer rebuilds the table from the PDF and matches columns automatically. If it can't find one, it asks you to pick it. CSV files and tables pasted from a web page work too.
3. **Plan:** click **Current (LCR) ▾ → New scenario from Current**. Then:
   - Drag a name onto a calling to move them there. Whoever was in it is released.
   - Hold **Ctrl** (or Alt) while dropping to *add* a calling without releasing the current one.
   - Drop a name on the **Available** column to release them.
   - Drop a name on **＋ New calling**, or click it and type a name, to propose a calling LCR doesn't have.
   - **Changes** lists every move. **Copy as text** gives the executive secretary a summary.
   - **Ctrl+Z** undoes. Scenarios save automatically; switch between them from the same menu.
4. **On the TV:**
   - Click an organization's name to show it full screen. **Esc** returns.
   - Press **B** to blank the screen instantly.
5. **Refresh data:** re-import the latest exports whenever you like. Scenarios are kept and flagged "Built on older LCR data".

### Time-in-calling colors
Green under 9 months · Amber 9–18 · Dark amber 18–24 · Red 24+. You can change these in **Settings**. The months also show as text, so the colors never have to carry the meaning alone.

### Backups and sharing between clerks
Data lives in one browser on one computer.
- **Settings → Download backup** saves everything (data and scenarios) to a JSON file.
- **Restore backup** loads it on another computer. This is how you hand scenarios to the other clerk.
- Backups contain names, so share them privately (not in GitHub) and delete old ones.

### When LCR has callings the board doesn't
The import preview lists **New callings found**. They still show up at the bottom of their organization. To sort them in properly, add them (with the LCR name as an `alias`) to [`src/model/template.ts`](src/model/template.ts).

## Developing

Requirements: Node 20+ and git.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # logic tests (import, tenure, scenarios)
npm run build    # what Vercel runs
```

Screenshots at TV resolutions (uses demo data):

```bash
npx playwright install chromium   # first time only
npm run build && npx vite preview --port 4173
npm run shots                     # in a second terminal; writes screenshots/
```

### Layout
| Path | What |
| --- | --- |
| `src/model/template.ts` | Built-in organizations and callings (and the LCR names they match) |
| `src/import/` | CSV parsing, column matching, LCR → board mapping, demo data |
| `src/model/scenario.ts` | Moves, releases, and the diff vs. Current (pure functions) |
| `src/model/board.ts` | Builds what the screen shows from the saved state |
| `src/store/` | React state and localStorage persistence (versioned, with migration) |
| `src/components/` | UI |

## Working together (two clerks)

- The repo lives on one clerk's personal GitHub account. The other clerk is added under **Settings → Collaborators**.
- Always `git pull` before you start. For anything bigger than a small fix, work on a branch and open a pull request.
- Vercel deploys every push to `main` automatically. Pull requests get their own preview link.

### Why public?
Vercel's free Hobby plan blocks deployments when someone other than the owner commits to a **private** repo. A public repo avoids that, and because member data never enters the code, nothing sensitive is exposed.
