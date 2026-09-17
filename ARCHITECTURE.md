# AI Life — architecture

## Purpose

AI Life is a browser-based persistent simulation in which Alpha and Beta act autonomously while the human remains an observer.

## Repository structure

```text
ai-life/
├── index.html          # stable HTML shell only
├── css/
│   └── style.css       # all presentation/UI styles
├── js/
│   └── main.js         # simulation and UI behavior
├── README.md
└── ARCHITECTURE.md
```

## Safe development rules

1. `index.html` stays small. Do not put the simulation back into it.
2. UI styling belongs in `css/style.css`.
3. Simulation and interaction logic belongs in `js/main.js`.
4. Small UI changes must not replace unrelated code.
5. Work on a feature branch first; `main` is the stable branch.
6. Before merging, verify that the complete files exist and that the branch contains the intended changes only.
7. Keep commits focused: one logical change per commit where practical.
8. Never overwrite a large file from a partial/truncated copy.
9. Preserve the persistent storage key unless a deliberate migration is planned.
10. The experiment remains observational: no hidden player controls or agent instructions are introduced by UI refactors.

## Current UI contract

- Top bar contains AI LIFE, model labels, experiment day, and a clock that must remain inside the panel on narrow screens.
- Bottom center contains the non-clickable experiment pill with start time, experiment day, and external intervention count.
- Large `🧠` orb remains available at bottom right.
- Opening the brain panel shows two separate circular metric widgets, one for Alpha and one for Beta, plus a compact event feed.
- The experiment block is not duplicated inside the brain panel.
- The `💻` orb remains the control/camera menu.

## Future direction

When the project grows, split `js/main.js` further into focused modules such as `world.js`, `agents.js`, `simulation.js`, `metrics.js`, and `ui.js`. Do that as a separate refactor with tests/checks, rather than mixing it into a feature change.
