import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from app.domains.orders.models import Order, OrderItem, OrderRating, OrderStatusHistory
from app.domains.orders.schemas import OrderCreate, OrderRatingCreate
from app.shared import codes
from app.shared.codes import CodeGenerationError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PricedItem:
    product_code: str
    name: str
    unit_price: float
    quantity: int
    notes: str


class OrderRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_orders(
        self,
        customer_id: int | None = None,
        merchant_code: str | None = None,
        courier_code: str | None = None,
    ) -> list[Order]:
        stmt = (
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.rating))
            .order_by(Order.id.desc())
        )
        if customer_id is not None:
            stmt = stmt.where(Order.customer_id == customer_id)
        if merchant_code is not None:
            stmt = stmt.where(Order.merchant_code == merchant_code)
        if courier_code is not None:
            stmt = stmt.where(Order.courier_code == courier_code)
        return list(self.db.scalars(stmt).all())

    def get_by_code(self, code: str) -> Order | None:
        stmt = (
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.rating))
            .where(Order.code == code)
        )
        return self.db.scalars(stmt).first()

    def lock_statement(self, code: str):
        """SELECT ... FOR UPDATE OF orders (no-op on SQLite): serializes writers on one order."""
        return select(Order).where(Order.code == code).with_for_update(of=Order)

    def get_by_code_for_update(self, code: str) -> Order | None:
        """Read the order holding its row lock until the caller's transaction commits."""
        return self.db.scalars(self.lock_statement(code)).first()

    def create(
        self,
        customer_id: int,
        customer_name: str,
        customer_phone: str,
        merchant_name: str,
        payload: OrderCreate,
        priced_items: list[PricedItem],
        delivery_fee: float,
        actor: str,
    ) -> Order:
        """Persist an already-priced order. Prices and fee come from the service, never the client."""
        subtotal = round(sum(i.unit_price * i.quantity for i in priced_items), 2)
        total = round(subtotal + delivery_fee, 2)

        for attempt in range(1, codes.MAX_ATTEMPTS + 1):
            code = codes.next_code(self.db, Order.code, "PED-", 1001)
            order = Order(
                code=code,
                merchant_code=payload.merchant_code,
                merchant_name=merchant_name,
                customer_id=customer_id,
                customer_name=customer_name,
                customer_phone=customer_phone,
                zone_slug=payload.zone_slug,
                delivery_address=payload.delivery_address,
                delivery_lat=payload.delivery_lat,
                delivery_lng=payload.delivery_lng,
                notes=payload.notes,
                payment_method=payload.payment_method,
                status="pendiente",
                subtotal=subtotal,
                delivery_fee=delivery_fee,
                total=total,
            )
            self.db.add(order)
            try:
                self.db.flush()
            except IntegrityError:
                self.db.rollback()
                logger.warning("order code collision: code=%s attempt=%s", code, attempt)
                continue

            for item in priced_items:
                self.db.add(
                    OrderItem(
                        order_id=order.id,
                        product_code=item.product_code,
                        name=item.name,
                        unit_price=item.unit_price,
                        quantity=item.quantity,
                        notes=item.notes,
                    )
                )
            self.db.add(
                OrderStatusHistory(
                    order_code=order.code,
                    previous_status=None,
                    new_status="pendiente",
                    actor=actor,
                )
            )
            self.db.commit()
            return self.get_by_code(code)  # type: ignore[return-value]
        raise CodeGenerationError("Could not allocate a unique order code.")

    def update_status(
        self, order: Order, new_status: str, actor: str, reason: str | None = None
    ) -> Order:
        previous = order.status
        order.status = new_status
        if reason:
            order.cancellation_reason = reason
        self.db.add(
            OrderStatusHistory(
                order_code=order.code,
                previous_status=previous,
                new_status=new_status,
                actor=actor,
                reason=reason,
            )
        )
        self.db.commit()
        return self.get_by_code(order.code)  # type: ignore[return-value]

    def assign_courier(self, order: Order, courier_code: str) -> Order:
        order.courier_code = courier_code
        self.db.commit()
        return self.get_by_code(order.code)  # type: ignore[return-value]

    def save_rating(self, order: Order, payload: OrderRatingCreate) -> Order:
        if order.rating:
            order.rating.merchant_stars = payload.merchant_stars
            order.rating.courier_stars = payload.courier_stars
            order.rating.comment = payload.comment
        else:
            rating = OrderRating(
                order_id=order.id,
                merchant_stars=payload.merchant_stars,
                courier_stars=payload.courier_stars,
                comment=payload.comment,
            )
            self.db.add(rating)
        self.db.commit()
        return self.get_by_code(order.code)  # type: ignore[return-value]
