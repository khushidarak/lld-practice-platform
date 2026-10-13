# LLD Practice — frontend

Learner UI for the LLD Practice Platform. React + Vite + TypeScript + Tailwind. No auth and no scoring: the app only renders what `VITE_API_URL` returns.

## Run

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

| Env var | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` | REST base path (no trailing slash required beyond `/api`) |
| `VITE_USE_MOCK` | unset (false) | Set to `true` to use `src/api/mockClient.ts` so you can demo the UI before the backend exists |

For a backend-free demo:

```
VITE_USE_MOCK=true
```

The mock keeps attempts and submissions in `localStorage` (`lld-mock-db`). In mock mode you can type `FORCE_FAIL` in assumptions to get a failed evaluation, or `FORCE_DEGRADED` to get a completed result with only rule-based criteria.

```bash
npm run build    # typecheck + production bundle
npm run preview  # serve the bundle
```

## Screens

- `/` — problem cards
- `/problems/:id` — requirements, start attempt, design form
- `/submissions/:id` — poll status, then criterion feedback
- `/history` — weak criteria + attempt list
