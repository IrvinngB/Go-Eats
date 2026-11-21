"""Shared user -> entity link mapping (by email, never by name).

Used by the seed (fresh DB) and by the startup migration backfill (existing DB).
"""

ENTITY_LINKS: dict[str, dict[str, str]] = {
    "merchants": {
        "hector.endara@ejemplo.pa": "c1",
        "patricia.motta@ejemplo.pa": "c2",
        "arturo.melo@ejemplo.pa": "c3",
        "monica.aleman@ejemplo.pa": "c4",
    },
    "couriers": {
        "javier.morales@ejemplo.pa": "r1",
        "maria.cedeno@ejemplo.pa": "r2",
        "luis.gomez@ejemplo.pa": "r3",
        "pedro.abrego@ejemplo.pa": "r4",
    },
}
