# Session and Route Guards Specification

## Purpose
Today any visitor can open any panel and the role/auth state is lost on reload (only tokens persist). The frontend MUST restore the session and enforce route access per role.

## Requirements

### Requirement: Session restored on reload
On application start, if a valid stored access token exists, the system MUST restore authenticated state, role and basic user data without a new login. The role MUST come from the verified session (token claim or server profile), never from separately editable storage.

#### Scenario: Reload as merchant
- GIVEN a logged-in merchant with stored tokens
- WHEN the page is reloaded on `/panel-comercio`
- THEN the user remains authenticated with role `merchant` and the panel renders

#### Scenario: No tokens
- GIVEN no stored tokens
- WHEN the app starts
- THEN state is anonymous

### Requirement: Public routes and anonymous redirect
Public routes are `/`, `/login`, `/tiendas` and `/tiendas/:id` (read-only browsing). Login is required for checkout, `/pedidos`, `/perfil` and all panels; any other route MUST redirect an anonymous user to `/login`. Guards MUST be installed by a separate installer, not inside the exported `routes`; route names (`landing`, `login`, `stores`, `store-detail`, `orders`, `profile`, `merchant`, `courier`, `accountant`, `admin`) and paths MUST NOT change.

#### Scenario: Direct URL
- GIVEN an anonymous visitor
- WHEN they open `/pedidos` or `/panel-admin`
- THEN they land on `/login`

#### Scenario: Public routes
- GIVEN an anonymous visitor
- WHEN they open `/`, `/login`, `/tiendas` or `/tiendas/:id`
- THEN the page renders without redirect

#### Scenario: Bare routes unguarded
- GIVEN a router built from the exported `routes` without the installer
- WHEN `/no-existe` is opened
- THEN it resolves to `/tiendas` (name `stores`)

### Requirement: Anonymous checkout redirect
When an anonymous user confirms checkout, the in-memory cart MUST be kept and the user sent to `/login?redirect=<path>`. After login, `redirect` MUST be honored only if it is an internal path allowed for the user's server role; otherwise the user goes to their role home (no open redirect).

#### Scenario: Checkout then login
- GIVEN an anonymous user with a cart on `/tiendas/s1`
- WHEN they confirm checkout and then log in as a customer
- THEN they land on `/tiendas/s1` with the cart intact

#### Scenario: Malicious redirect
- GIVEN `/login?redirect=https://evil.example` or a panel path of another role
- WHEN login succeeds
- THEN the user lands on their role home

### Requirement: Role-based route access
An authenticated user opening a route not allowed for their role MUST be redirected to their home route given by `rutaPorRol` (customer `/tiendas`, merchant `/panel-comercio`, courier `/panel-repartidor`, accountant `/panel-contabilidad`, admin `/panel-admin`). Customer routes are `/tiendas`, `/tiendas/:id`, `/pedidos`, `/perfil`; customer routes are allowed only to customers (admin included in the redirect), and each panel route is allowed only to its own role.

#### Scenario: Customer to admin panel
- GIVEN a logged-in customer
- WHEN they navigate to `/panel-admin`
- THEN they are redirected to `/tiendas`

#### Scenario: Merchant to customer route
- GIVEN a logged-in merchant
- WHEN they navigate to `/pedidos`
- THEN they are redirected to `/panel-comercio`

#### Scenario: Authenticated at login page
- GIVEN a logged-in courier
- WHEN they open `/login`
- THEN they MUST be redirected to `/panel-repartidor`
(Previously: MAY)

#### Scenario: Admin on customer route
- GIVEN a logged-in admin
- WHEN they open `/tiendas` or `/pedidos`
- THEN they are redirected to `/panel-admin`

### Requirement: Unknown paths
The catch-all MUST keep redirecting to `/tiendas`, after which the guard applies: an anonymous user stays on the public `/tiendas`; an authenticated non-customer ends at their role home.
(Previously: anonymous user ended at `/login`)

#### Scenario: Unknown path anonymous
- GIVEN an anonymous visitor
- WHEN they open `/no-existe`
- THEN they end at `/tiendas`

#### Scenario: Unknown path merchant
- GIVEN a logged-in merchant
- WHEN they open `/no-existe`
- THEN they end at `/panel-comercio`

### Requirement: Expiry and refresh failure log out
When the access token expires and refresh succeeds, the session MUST continue transparently. When refresh fails (or no refresh token), the system MUST clear tokens and user state, notify the user, and redirect to `/login`.

#### Scenario: Silent refresh
- GIVEN an expired access token and a valid refresh token
- WHEN an API call returns 401
- THEN a refresh occurs and the call is retried successfully

#### Scenario: Refresh rejected
- GIVEN an invalid refresh token
- WHEN an API call returns 401
- THEN the session is cleared and the user is on `/login`

#### Scenario: Anonymous public sync
- GIVEN an anonymous visitor on the landing page with no refresh token
- WHEN public sync calls fail or return 401
- THEN no redirect and no logout notice occur (the router hook fires only for a previously authenticated session)

### Requirement: Store sync tolerates per-call failures
When anonymous, sync MUST call public endpoints only (zones, merchants, catalog, couriers). Sync MUST use `Promise.allSettled` semantics so a 401/403 or failure of one call never drops data from the others, and a backend outage MUST NOT show a toast.

#### Scenario: One call forbidden
- GIVEN a customer session where payments return 403
- WHEN sync runs
- THEN zones and merchants are still loaded

#### Scenario: Anonymous sync
- GIVEN an anonymous visitor
- WHEN sync runs
- THEN only public endpoints are requested and at least one is called

### Requirement: No offline fake login
When the backend is unreachable, login and register MUST fail with a visible error and MUST NOT mark the user authenticated or assign a role locally.

#### Scenario: Backend down
- GIVEN the API is unreachable
- WHEN the user submits login for role `admin`
- THEN an error is shown and the state remains anonymous

### Requirement: Logout
Logout MUST clear tokens and user state and send the user to `/login` or the landing page; protected routes MUST then redirect to `/login`.

#### Scenario: Back button after logout
- GIVEN a user logged out
- WHEN they navigate back to a protected route
- THEN they are redirected to `/login`

### Requirement: Demo switcher is dev-only
The TopBar demo account switcher and the LoginView role picker MUST appear only when the frontend build-time flag `VITE_ENABLE_DEMO_SWITCHER` is `'true'` (default OFF), and the switcher MUST authenticate through the normal login so roles come from the server. LoginView MUST navigate by the role returned by the SERVER, never the role selected in the UI.

#### Scenario: Flag off
- GIVEN a production-like build/config
- WHEN the TopBar and LoginView render
- THEN no demo switcher or role picker is shown

#### Scenario: Server role wins
- GIVEN the picker is shown with `admin` selected and the account is a customer
- WHEN login succeeds
- THEN the user lands on `/tiendas`
