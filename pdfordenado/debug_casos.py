import pdfplumber
import re

pdf_path = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\Inbound-61958574-preparation-instructions (2) (1).pdf"

skus_to_find = [
    'NMIDKUHZMH-TE0-T41',  # Stride Hombre Marrón
    'NMIDKRDJUG-RO0-T37',  # New Blaze Coral
    'NMIDKRHJUH-AM0-T41',  # New Blaze Hombre
    'NDPMB6E773-NN0-44',   # Buzo Micropolar Negro
]

print("Buscando casos problemáticos...\n")

with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        
        for table in tables:
            if not table or len(table) < 2:
                continue
            
            for row in table[1:]:
                if not row or len(row) < 2:
                    continue
                
                producto_text = row[0] if row[0] else ''
                cantidad = row[1] if len(row) > 1 else ''
                
                for sku in skus_to_find:
                    if sku in producto_text:
                        print("=" * 100)
                        print(f"SKU: {sku}")
                        print(f"Cantidad: {cantidad}")
                        print(f"\nTexto completo:")
                        print(producto_text)
                        print(f"\nLíneas:")
                        lines = [l.strip() for l in producto_text.split('\n') if l.strip()]
                        for i, line in enumerate(lines):
                            print(f"  [{i}] {line}")
                        print()
