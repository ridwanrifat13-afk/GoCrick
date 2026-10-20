# SGHS-23 Cricket Tournament Season 2 — Live Draft & Match Center

A real-time, offline-resilient tournament command center built for the **SGHS-23 Cricket Tournament Season 2** on October 22nd. The platform powers a live, shareable group-by-group player draft (assigning 21 grouped players across 3 captained teams), ball-by-ball match scoring with commentary, live player statistics, match notifications, and archival PDF exports.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core tournament workflows and architectural choices have been locked in based on your specifications:

- **Confirmed Decision 1 — Tournament Format**: **Round-Robin League + Grand Final** across the 3 teams (3 league fixtures where every team plays each other once, followed by the top 2 teams advancing to the Grand Final), with customizable overs per innings (defaulting to 6 overs, adjustable per match).
- **Confirmed Decision 2 — Live Draft Mechanics**: **Dramatic One-by-One Card Reveal** per performance group (Groups A through G, 3 players per group). When the organizer shuffles a group, cards are drawn and revealed sequentially for Team 1, Team 2, and Team 3 in real time across all connected spectator devices.
- **Confirmed Decision 3 — Access Control**: **Organizer PIN Code Protection** (`2323` default, customizable in organizer settings) unlocks draft shuffling, roster editing, and live ball-by-ball scoring while anyone joining via the shareable session link enjoys a synchronized live spectator experience.
- **Offline-First & Real-Time Sync Strategy**: Combines a real-time WebSocket server (for instant live draft reveals, scoreboard updates, and push-style match event notifications across connected viewers) with an IndexedDB/LocalStorage offline mutation queue so scorers in remote match venues never lose a single ball if connectivity drops.

---

## 1. Overview & Core Concept

- **What It Does**:
  - **Customisable Roster & Group Setup**: Manage the 3 Team Captains, team names/colors, and 21 players categorized into 7 performance-tiered groups (**Group A** through **Group G**, 3 players each).
  - **Live Shareable Draft Studio**: Broadcasts the group-by-group shuffle in real time to all players joining via the shareable link, complete with dramatic one-by-one card reveals and instant squad table updates.
  - **Real-Time Ball-by-Ball Scoreboard**: Tracks runs, wickets, overs, legal balls, extras (Wide, No Ball, Bye, Leg Bye), strike rotation, bowler figures, and live ball-by-ball commentary.
  - **Match Center, Visual Summary & Player Stats**: Displays the Round-Robin + Grand Final schedule, Net Run Rate (NRR) standings table, visual match summaries (worm/manhattan run progression & key partnerships), and leaderboards for Orange Cap (Most Runs), Purple Cap (Most Wickets), and MVP points.
  - **Notifications & PDF Archives**: Delivers real-time match event notifications (wickets, boundaries, milestones, innings breaks, draft picks) with an audio/visual toast alert system, and generates formatted PDF documents for both **Final Team Squads** and **Official Match Scorecards**.
- **Target Audience / Persona**: Tournament organizers, scorers at the ground (including low-connectivity outdoor venues), and the 24 SGHS-23 players following the live draft and match scores on mobile and desktop.
- **Key Value**: Eliminates manual paper draws and fragmented scoring apps by unifying transparent team formation, live broadcast-grade scoring, offline resilience, and permanent PDF tournament records in a single platform.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Joining via Shareable Link & Header Bar**:
   - Users land on the **SGHS-23 Cricket Tournament Season 2** hub featuring a customizable tournament logo placeholder slot, tournament countdown/date header (October 22), live sync status indicator, dark/light stadium mode toggle, and **Share Session Link** button.
   - Spectators browse live views immediately; clicking **Unlock Organizer Mode** prompts for the Organizer PIN to enable editing, shuffling, and scoring controls.
2. **Pre-Draft Roster Customization & Live Shuffling**:
   - In the **Live Draft** view, the 3 teams are anchored at the top with their respective Captains. Below, Groups **A, B, C, D, E, F, and G** (3 players each) are displayed in clean performance-tier rows.
   - Organizers can customize any captain name, team name, player name, playing role (Batter, Bowler, All-Rounder, Wicketkeeper), or group assignment.
   - Clicking **Shuffle Group [X]** initiates a synchronized countdown and draws cards one by one—revealing which player from that group joins Team 1, Team 2, and Team 3. Once all 7 groups are drafted (8 players per team including captain), organizers or players can click **Export Squads PDF**.
3. **Live Scoring & Offline Sync Flow**:
   - In the **Scoreboard** view, the organizer selects an active fixture (Match 1, Match 2, Match 3, or Grand Final), sets the overs limit, chooses toss/batting order, and selects opening batters and bowler.
   - Each ball is logged via ergonomic 1-tap scoring controls (`0`, `1`, `2`, `3`, `4`, `6`, `Wicket`, `WD`, `NB`, `BYE`, `LB`, plus `Undo Last Ball`) paired with optional or auto-generated ball-by-ball commentary.
   - If the device loses internet at a remote cricket ground, balls are queued locally with an **Offline — Queued for Sync** badge and automatically reconciled with the server and all connected spectators the moment connectivity returns.
4. **Analytics, Visual Match Summary & Scorecard PDF Export**:
   - Spectators and players explore **Stats & Standings** for the tournament points table (with Net Run Rate), visual run-rate comparison charts, batting/bowling leaderboards, and one-click **Export Scorecard PDF** for any completed or live match.

### Visual Identity & Theme
- **Aesthetic Direction**: Broadcast Cricket Stadium & High-Precision Telemetry — inspired by modern international cricket broadcast graphics (clean athletic typography, crisp tabular scoreboards, floodlight dark mode, and turf-inspired accents).
- **Color Palette & Mood (Day/Night Stadium Posture)**:
  - **Dark Mode (Default for Floodlight / Day-Night Legibility)**:
    - `--background`: Deep Stadium Night Slate (`#0B111E`)
    - `--surface`: Elevated Pavilion Slate (`#131C2E`) with subtle `1px solid #1E293B` hairline dividers
    - `--primary`: Turf Emerald (`#10B981`) for primary CTAs, active draft states, and safe sync indicators
    - `--accent`: Floodlight Gold (`#F59E0B`) for boundaries (`4` / `6`), captain insignias, and trophy highlights
    - `--danger`: Leather Ball Crimson (`#EF4444`) for Wickets (`W`) and live broadcast indicators
  - **Light Mode (High-Contrast Outdoor Daylight Posture)**:
    - `--background`: Crisp Pitch Alabaster (`#F8FAFC`)
    - `--surface`: Pure Pavilion White (`#FFFFFF`) with `#E2E8F0` borders
    - `--primary`: Deep Outfield Green (`#047857`)
- **Typography & Hierarchy (2+1 Font Rule)**:
  - **Display / Headings**: `Outfit` (600/700 weight) for athletic, authoritative tournament headers, team banners, and draft reveal cards.
  - **Body & Commentary**: `Plus Jakarta Sans` (400/500/600) for clean legibility across player lists and ball-by-ball commentary feeds.
  - **Scoreboard & Telemetry Numerals**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for runs, wickets, overs (`4.2`), strike rates, economy rates, and Net Run Rate alignment.
- **Component Styling & Layout**:
  - Follows the 3-zone Top Bar Contract: Brand lockup with customisable logo placeholder on the left, 4 single-line view navigation links (`Live Draft`, `Scoreboard`, `Matches & Summary`, `Player Stats`) in the center, and primary session actions (`Share Link` / `Organizer Lock`) on the right.
  - Zero-pill discipline for static metadata (player roles, economy rates, over summaries rendered as clean inline text with `·` separators) while interactive scoring pads and filter tabs use tactile button surfaces ($\ge 44\times 44\text{px}$ hitboxes for mobile field scoring).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hybrid Server-Authoritative WebSocket + Offline IndexedDB Queue**
  - *Chosen Approach*: Express + WebSocket (`ws`) server on port 3000 holding authoritative tournament state (persisted to disk on the server) paired with client-side local storage caching and an idempotent offline action queue.
  - *Why*: Satisfies both core requirements simultaneously—players opening the shareable link see live draft card reveals and ball-by-ball updates in real time, while the scorer at a remote cricket ground can keep scoring seamlessly during mobile network dropouts and auto-sync upon reconnection.
  - *Alternatives Considered*: Pure client-side storage (fails live shareable link requirement) or cloud-only requests without local queueing (fails remote ground offline resilience).
- **Decision 2: Deterministic Dramatic 1-by-1 Group Shuffle State Machine**
  - *Chosen Approach*: When the organizer triggers a shuffle on Group $X$ (containing 3 players), the server computes a cryptographically fair random permutation assigning the 3 players to Team 1, Team 2, and Team 3, and broadcasts a staged reveal state (`shuffling` $\rightarrow$ `reveal_team_1` $\rightarrow$ `reveal_team_2` $\rightarrow$ `reveal_team_3` $\rightarrow$ `completed`).
  - *Why*: Ensures every connected spectator sees the exact same dramatic one-by-one card flip sequence at the same moment without desynchronization.
- **Decision 3: Client-Side Vector PDF Generation for Squads & Scorecards**
  - *Chosen Approach*: Dedicated print-optimized vector PDF generation (using `jspdf` + `jspdf-autotable`) producing official tournament documents with the "SGHS-23 Cricket Tournament season 2" masthead, date, team rosters by group, and full batting/bowling/fall-of-wickets scorecards.
  - *Why*: Works 100% offline at the tournament venue without requiring an external rendering server.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATION (React 19 + Vite)                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Top Navigation Bar: Logo Slot | 4 View Tabs | Dark Mode | Share | PIN  │  │
│  └───────────────┬──────────────────┬──────────────────┬──────────────────┘  │
│                  │                  │                  │                     │
│     ┌────────────▼─────┐   ┌────────▼────────┐  ┌──────▼──────────────────┐  │
│     │ Live Draft Studio│   │ Live Scoreboard │  │ Matches, Visual Summary │  │
│     │ • 3 Team Columns │   │ • Innings Header│  │ & Player Stats          │  │
│     │ • Captains Setup │   │ • Batter/Bowler │  │ • Round-Robin + Final   │  │
│     │ • Groups A–G (21)│   │ • 1-Tap Scoring │  │ • NRR Points Table      │  │
│     │ • 1-by-1 Card    │   │ • Ball-by-Ball  │  │ • Run Worm & Manhattan  │  │
│     │   Reveal Stage   │   │   Commentary    │  │ • Batting/Bowling Caps  │  │
│     │ • Squad PDF Gen  │   │ • Scorecard PDF │  │ • Notification Center   │  │
│     └────────────┬─────┘   └────────┬────────┘  └──────┬──────────────────┘  │
│                  └──────────────────┼──────────────────┘                     │
│                                     ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │          Offline-First Sync Engine & Notification Dispatcher           │  │
│  │  • Local State Cache (LocalStorage) + Pending Action Queue (Idempotent)│  │
│  │  • Match Event Detector (Wickets, 4s, 6s, 50s, Draft Picks -> Toasts)  │  │
│  └──────────────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────────────┼────────────────────────────────────────┘
                                      │ WebSocket (ws://) + REST Fallback (/api)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 EXPRESS + WEBSOCKET SERVER (Port 3000)                       │
│  • Room/Session Broadcast Engine (Live Spectators + Organizer Sync)          │
│  • Idempotent Event Processor (draft:shuffleGroup, match:recordBall, etc.)   │
│  • Persistent JSON State Store (survives server restarts)                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **Tournament Config**: Title (`"SGHS-23 Cricket Tournament season 2"`), date (`"2026-10-22"`), custom logo DataURL (with cricket crest placeholder default), organizer PIN hash, default overs per match.
- **Teams (3)**: `id`, `name`, `shortName`, `color`, `captainName`, `draftedPlayers` (list of player IDs mapped from Groups A–G).
- **Player Pool (24 Total = 3 Captains + 21 Grouped Players)**: `id`, `name`, `group` (`'CAPTAIN' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'`), `role` (`'Batter' | 'Bowler' | 'All-Rounder' | 'WK'`), `assignedTeamId`, `revealOrder` (`1 | 2 | 3`).
- **Draft State**: Per-group status (`'pending' | 'revealing' | 'completed'`), current reveal step (`0 | 1 | 2 | 3`), active group ID, and draft history log.
- **Matches (4 Total — 3 Round-Robin League Matches + 1 Grand Final)**:
  - `id`, `matchNumber`, `stage` (`'League' | 'Final'`), `teamAId`, `teamBId`, `oversLimit`, `status` (`'Upcoming' | 'Live' | 'Completed'`), `tossWinnerId`, `tossDecision`, `currentInnings` (`1 | 2`).
  - **Innings Data**: `battingTeamId`, `bowlingTeamId`, `runs`, `wickets`, `legalBalls`, `extras` (`wides`, `noBalls`, `byes`, `legByes`), `strikerId`, `nonStrikerId`, `currentBowlerId`, `ballLog` (array of ball events with `id`, `overBall`, `runs`, `isExtra`, `isWicket`, `wicketType`, `dismissedPlayerId`, `commentary`, `timestamp`).
- **Notifications**: `id`, `type` (`'WICKET' | 'FOUR' | 'SIX' | 'MILESTONE' | 'DRAFT' | 'MATCH_RESULT'`), `title`, `message`, `timestamp`.

### Interactive Component & State Mapping
- **Roster & Group Editor**: Inline editing modal/drawer allowing the organizer to rename any of the 3 captains or 21 players in Groups A–G, swap players between groups, or reset a group's draft status, immediately broadcasting `roster:update` to all connected clients.
- **Dramatic 1-by-1 Shuffle Sequence**: Clicking `Shuffle Group [A–G]` dispatches `draft:startGroupShuffle`. The UI enters the stage modal/spotlight, revealing Card 1 (assigned to Team 1) at $t=0.8\text{s}$, Card 2 (Team 2) at $t=2.0\text{s}$, and Card 3 (Team 3) at $t=3.2\text{s}$ (with manual "Reveal Next Card" override control as well), then commits the players to the 3 team columns and triggers a notification.
- **Live Scoreboard & Ball-by-Ball Engine**: Recording a ball validates active striker/non-striker and bowler selection, computes automatic strike rotation on odd runs and end-of-over (`legalBalls % 6 === 0`), prompts for a new batter on a wicket or new bowler at the end of an over, appends a rich commentary line, and pushes a live notification banner on boundaries (`4`/`6`), wickets (`W`), and match completion.
- **Offline Queue Reconciliation**: Every organizer action carries a unique UUID `actionId`. When offline, mutations apply optimistically to local state and push to `pendingActions`. Upon WebSocket reconnection (`online` event), queued actions flush in order; the server deduplicates by `actionId` and broadcasts the canonical tournament state.
