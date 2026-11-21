"""Collision-free business codes (PED-, TX-): max numeric suffix + 1, never row count."""
import re

from sqlalchemy import select
from sqlalchemy.orm import InstrumentedAttribute, Session

MAX_ATTEMPTS = 3


class CodeGenerationError(RuntimeError):
    """Raised when a unique code could not be allocated after MAX_ATTEMPTS tries."""


def next_sequence(db: Session, column: InstrumentedAttribute, prefix: str, floor: int) -> int:
    """Highest numeric suffix among codes shaped `<prefix><digits>`, plus one (>= floor).

    Codes that do not match the shape are ignored, so gaps, deletions and legacy values
    never break generation.
    """
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
    highest = floor - 1
    for (code,) in db.execute(select(column).where(column.like(f"{prefix}%"))):
        match = pattern.match(code or "")
        if match:
            highest = max(highest, int(match.group(1)))
    return highest + 1


def next_code(db: Session, column: InstrumentedAttribute, prefix: str, floor: int) -> str:
    return f"{prefix}{next_sequence(db, column, prefix, floor)}"
