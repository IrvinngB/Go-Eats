# Frontend Testing Specification

## Purpose
Provide a working frontend test runner so Strict TDD (test first) is possible for every later change.

## Requirements

### Requirement: Tooling installed
The project MUST declare vitest, @vue/test-utils and jsdom as dev dependencies, installed with pnpm and reflected in the lockfile.

#### Scenario: Dependencies present
- GIVEN a fresh checkout
- WHEN `pnpm install --frozen-lockfile` runs
- THEN it succeeds and the three packages are resolvable

### Requirement: Single test command
The project MUST expose `pnpm test` that runs the suite once non-interactively and exits non-zero on failure.

#### Scenario: Passing suite
- GIVEN all specs pass
- WHEN `pnpm test` runs
- THEN it exits 0

#### Scenario: Failing suite
- GIVEN a spec with a failing assertion
- WHEN `pnpm test` runs
- THEN it exits non-zero and reports the failing spec

### Requirement: DOM environment
Specs MUST run in a simulated browser DOM so Vue components can be mounted.

#### Scenario: Mounting a component
- GIVEN a spec that mounts a Vue component
- WHEN it runs
- THEN the component renders and its text can be queried

### Requirement: Spec discovery
The runner MUST discover colocated `*.spec.ts` files under `src/` and MUST NOT run non-test files.

#### Scenario: Colocated spec
- GIVEN `Foo.spec.ts` beside `Foo.vue`
- WHEN `pnpm test` runs
- THEN the spec is executed

### Requirement: Smoke spec
The project MUST include at least one smoke spec proving the runner and DOM mounting work.

#### Scenario: Smoke passes
- GIVEN the repository after setup
- WHEN `pnpm test` runs
- THEN the smoke spec is reported as passed

### Requirement: Strict TDD usable
Tooling MUST allow a failing spec to be written before implementation and observed failing (red) then passing (green).

#### Scenario: Red then green
- GIVEN a spec for a component that does not exist yet
- WHEN `pnpm test` runs
- THEN it fails
- AND after the component is implemented it passes

### Requirement: Coexistence with build
Test configuration MUST NOT break `pnpm build` or `pnpm exec vue-tsc -b`, and spec files MUST NOT be shipped in the production bundle.

#### Scenario: Build unaffected
- GIVEN test tooling is installed
- WHEN `pnpm exec vue-tsc -b` and `pnpm build` run
- THEN both succeed and the output contains no spec files
