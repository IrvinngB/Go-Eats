from abc import ABC, abstractmethod
from dataclasses import dataclass
import uuid


@dataclass(frozen=True)
class PaymentGatewayResult:
    approved: bool
    provider_reference: str
    status: str
    message: str


class PaymentProvider(ABC):
    """Adapter pattern interface for payment processing without storing card data (PCI-DSS / RF-10)."""

    @abstractmethod
    def process(self, order_code: str, amount: float, simulate_failure: bool = False) -> PaymentGatewayResult:
        raise NotImplementedError


class CashOnDeliveryProvider(PaymentProvider):
    def process(self, order_code: str, amount: float, simulate_failure: bool = False) -> PaymentGatewayResult:
        ref = f"COD-{uuid.uuid4().hex[:8].upper()}"
        return PaymentGatewayResult(
            approved=True,
            provider_reference=ref,
            status="pendiente",
            message=f"Pago contra entrega registrado para {order_code} por B/ {amount:.2f}",
        )


class SimulatedElectronicPaymentProvider(PaymentProvider):
    """Simulated electronic payment gateway modeling Paguelo Fácil / Yappy."""

    def __init__(self, channel: str = "yappy") -> None:
        self.channel = channel

    def process(self, order_code: str, amount: float, simulate_failure: bool = False) -> PaymentGatewayResult:
        prefix = "YPY" if self.channel == "yappy" else "PGF"
        ref = f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
        if simulate_failure:
            return PaymentGatewayResult(
                approved=False,
                provider_reference=ref,
                status="fallido",
                message="Transacción rechazada por el emisor en pasarela simulada.",
            )
        return PaymentGatewayResult(
            approved=True,
            provider_reference=ref,
            status="pagado",
            message=f"Pago electrónico ({self.channel}) aprobado con referencia {ref}.",
        )


def get_payment_provider(method: str) -> PaymentProvider:
    if method == "contr_entrega":
        return CashOnDeliveryProvider()
    return SimulatedElectronicPaymentProvider(channel=method)
