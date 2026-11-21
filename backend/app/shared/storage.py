"""MinIO / S3 compatible storage service and PDF receipt generator (RF-12)."""


def generate_receipt_pdf_bytes(
    receipt_number: str,
    order_code: str,
    merchant_name: str,
    customer_name: str,
    payment_method: str,
    subtotal: float,
    delivery_fee: float,
    total: float,
    issued_at: str,
) -> bytes:
    """Build a valid, lightweight PDF 1.4 document for payment receipts without heavy native dependencies."""
    lines = [
        "COMERCIOS UNIDOS DEL ISTMO, S.A. - GO EATS",
        f"Comprobante Digital: {receipt_number}",
        f"Fecha de emision: {issued_at}",
        f"Pedido: {order_code}",
        f"Comercio: {merchant_name}",
        f"Cliente: {customer_name}",
        f"Metodo de pago: {payment_method}",
        f"Subtotal: B/ {subtotal:.2f}",
        f"Tarifa de envio: B/ {delivery_fee:.2f}",
        f"TOTAL PAGADO: B/ {total:.2f}",
    ]
    text_ops = ["BT", "/F1 11 Tf", "50 750 Td", "16 TL"]
    for idx, line in enumerate(lines):
        safe_line = line.replace("(", "\\(").replace(")", "\\)")
        if idx == 0:
            text_ops.append(f"({safe_line}) Tj")
        else:
            text_ops.append(f"T* ({safe_line}) Tj")
    text_ops.append("ET")
    stream_content = "\n".join(text_ops).encode("latin-1", errors="replace")

    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        + f"4 0 obj << /Length {len(stream_content)} >> stream\n".encode("ascii")
        + stream_content
        + b"\nendstream endobj\n"
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"xref\n0 6\n"
        b"0000000000 65535 f \n"
        b"trailer << /Size 6 /Root 1 0 R >>\n"
        b"startxref\n0\n%%EOF"
    )
    return pdf
