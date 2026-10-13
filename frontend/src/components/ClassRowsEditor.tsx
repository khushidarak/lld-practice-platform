import type { ClassKind } from '../types'

export type ClassRowDraft = {
  id: string
  name: string
  kind: ClassKind
  responsibility: string
  keyMethods: string
}

type Props = {
  rows: ClassRowDraft[]
  errors: Record<string, string>
  onChange: (rows: ClassRowDraft[]) => void
}

export function ClassRowsEditor({ rows, errors, onChange }: Props) {
  function update(id: string, patch: Partial<ClassRowDraft>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function remove(id: string) {
    onChange(rows.length === 1 ? rows : rows.filter((row) => row.id !== id))
  }

  function add() {
    onChange([
      ...rows,
      {
        id: crypto.randomUUID(),
        name: '',
        kind: 'class',
        responsibility: '',
        keyMethods: '',
      },
    ])
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-ink">Classes & interfaces</legend>
      <p className="text-sm text-ink-muted">
        Name each type, its job, and the methods that matter. Separate methods with commas.
      </p>

      <ul className="space-y-3">
        {rows.map((row, index) => {
          const error = errors[row.id]
          return (
            <li
              key={row.id}
              className="rounded-xl border border-line bg-card p-3 sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Type {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  disabled={rows.length === 1}
                  className="text-sm text-accent-2 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium" htmlFor={`class-name-${row.id}`}>
                    Name
                  </label>
                  <input
                    id={`class-name-${row.id}`}
                    value={row.name}
                    onChange={(e) => update(row.id, { name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium" htmlFor={`class-kind-${row.id}`}>
                    Kind
                  </label>
                  <select
                    id={`class-kind-${row.id}`}
                    value={row.kind}
                    onChange={(e) => update(row.id, { kind: e.target.value as ClassKind })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="class">class</option>
                    <option value="interface">interface</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label
                    className="block text-sm font-medium"
                    htmlFor={`class-resp-${row.id}`}
                  >
                    Responsibility
                  </label>
                  <input
                    id={`class-resp-${row.id}`}
                    value={row.responsibility}
                    onChange={(e) => update(row.id, { responsibility: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    className="block text-sm font-medium"
                    htmlFor={`class-methods-${row.id}`}
                  >
                    Key methods
                  </label>
                  <input
                    id={`class-methods-${row.id}`}
                    value={row.keyMethods}
                    onChange={(e) => update(row.id, { keyMethods: e.target.value })}
                    placeholder="park, unpark, issueTicket"
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              {error ? (
                <p className="mt-2 text-sm text-bad" role="alert">
                  {error}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={add}
        className="rounded-lg border border-dashed border-accent px-3 py-2 text-sm font-medium text-accent hover:bg-paper-2"
      >
        Add type
      </button>
    </fieldset>
  )
}

export function emptyClassRow(): ClassRowDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    kind: 'class',
    responsibility: '',
    keyMethods: '',
  }
}
