# Customer Consent and ARCO Specification

## Purpose
Ley 81 consent is defaulted to true server-side, forced true on login, not persisted from the profile toggle, and ARCO requests are listed from a public endpoint (RF-07, RF-09). Consent MUST be explicit, persisted and revocable, and ARCO MUST work for the owning customer.

## Requirements

### Requirement: Explicit consent on registration
`accepts_privacy_policy` MUST have no default; registration without it MUST fail with 422, and with `false` MUST fail with 400. On success the system MUST persist a `data_consents` record (user, policy version, accepted true, timestamp).

#### Scenario: Field omitted
- GIVEN a register payload without `accepts_privacy_policy`
- WHEN submitted
- THEN the response is 422 and no user is created

#### Scenario: Accepted
- GIVEN `accepts_privacy_policy: true`
- WHEN submitted
- THEN the user exists and one accepted consent with the current policy version is stored

### Requirement: Consent never forced on login
Login MUST NOT create, modify or imply consent, and the login form MUST NOT require the consent checkbox. The store MUST derive `consentimientoLey81` from the server consent state, never hardcode true.

#### Scenario: Login without checkbox
- GIVEN an existing user
- WHEN they log in
- THEN no consent record is added and login succeeds

#### Scenario: Revoked user logs in
- GIVEN a user whose latest consent is revoked
- WHEN the profile loads
- THEN the toggle shows off

### Requirement: Read and revoke consent
`GET /users/me/consent` MUST return `{accepted, policy_version, accepted_at}` from the latest record (latest = highest id, not timestamp); with no record, `accepted` is false and the other fields null. `PUT /users/me/consent` with `{accepted: bool}` MUST append a record at the current policy version and return the new state; revoke and re-grant are the same call. History is preserved and changes persist across sessions.

#### Scenario: No record
- GIVEN a user with no consent record
- WHEN `GET /users/me/consent` is called
- THEN `accepted` is false and `policy_version` and `accepted_at` are null

#### Scenario: Same-second changes
- GIVEN revoke then re-grant within one second
- WHEN consent is read
- THEN the state reflects the record with the highest id

#### Scenario: Revoke
- GIVEN a user with accepted consent
- WHEN they revoke it
- THEN the latest record has accepted false with a timestamp and earlier records remain

#### Scenario: Re-grant
- GIVEN revoked consent
- WHEN the user grants it again
- THEN the latest record has accepted true for the current policy version

#### Scenario: Not for others
- GIVEN user A
- WHEN A changes consent
- THEN only A's records are affected

### Requirement: Create ARCO request
An authenticated customer MUST be able to create an ARCO request whose `request_type` is a closed set (Acceso, Rectificación, Cancelación, Oposición; anything else 422) with a detail of 5 to 1000 characters; it is stored with status `pendiente` and linked to the caller (never a client-chosen user).

#### Scenario: Valid request
- GIVEN a logged-in customer
- WHEN they submit type `Acceso` with a valid detail in ProfileView
- THEN the request is stored as `pendiente` and appears in their list

#### Scenario: Invalid type or short detail
- GIVEN an unknown type or a 3-character detail
- WHEN submitted
- THEN the response is 422 and nothing is stored

### Requirement: List own ARCO requests
The system MUST provide an own-scoped list (`GET /users/me/arco`) returning only the caller's requests, newest first, including status and admin response. The admin-wide list remains admin-only (see customer-authorization).

#### Scenario: Own only
- GIVEN requests from customers A and B
- WHEN A lists their requests
- THEN only A's are returned

#### Scenario: Responded request
- GIVEN an admin resolved A's request
- WHEN A lists
- THEN the status is `respondida` with the admin response

### Requirement: ProfileView wired to the API
ProfileView MUST load consent and own ARCO requests from the API, persist the consent toggle and ARCO creation through the API, and show an error and keep prior state when a write fails.

#### Scenario: Toggle failure
- GIVEN the consent write fails
- WHEN the user flips the toggle
- THEN the toggle returns to its prior value and an error is shown

### Requirement: Privacy policy access
The policy button/link in LoginView MUST either open the policy content (version shown) or be removed; it MUST NOT be an inert control.

#### Scenario: Policy opens
- GIVEN the login/register screen
- WHEN the user activates the policy control
- THEN the policy text or page is shown, or the control does not exist

### Requirement: Effect of revoked consent
While the latest consent is `accepted=false` or the user has no consent record, `POST /orders/` and `POST /payments/` MUST return 403 with detail `consent_required`, and the UI MUST show a Spanish message linking to Perfil. Data MUST be kept; reads (own orders, own ARCO, profile, consent) keep working and the account is never deleted.
(Previously: effect was undecided)

#### Scenario: Revoked blocks order
- GIVEN a customer whose latest consent is revoked
- WHEN they post an order
- THEN the response is 403 `consent_required` and no order is created

#### Scenario: Missing consent blocks payment
- GIVEN a customer with no consent record
- WHEN they post a payment
- THEN the response is 403 `consent_required`

#### Scenario: Re-grant unblocks
- GIVEN a revoked customer
- WHEN they `PUT /users/me/consent` with `accepted: true` and post an order
- THEN the order is created

#### Scenario: Revoke does not erase
- GIVEN a user revokes consent
- WHEN their data is read
- THEN the account and orders remain
