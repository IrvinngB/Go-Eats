from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.domains.orders.models import Order, OrderItem, OrderRating, OrderStatusHistory
from app.domains.orders.schemas import OrderCreate, OrderRatingCreate


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

    def create(self, customer_id: int, payload: OrderCreate,actor: str) -> Order:
        subtotal = round(sum(item.unit_price * item.quantity for item in payload.items), 2)
        total = round(subtotal + payload.delivery_fee, 2)
        seq = len(self.list_orders()) + 1001
        code = f"PED-{seq}"

        order = Order(
            code=code,
            merchant_code=payload.merchant_code,
            merchant_name=payload.merchant_name,
            customer_id=customer_id,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            zone_slug=payload.zone_slug,
            delivery_address=payload.delivery_address,
            notes=payload.notes,
            payment_method=payload.payment_method,
            status="pendiente",
            subtotal=subtotal,
            delivery_fee=payload.delivery_fee,
            total=total,
        )
        self.db.add(order)
        self.db.flush()

        for item in payload.items:
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
        return self.get_by_code(order.code)  # type: ignore[return-value]

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
