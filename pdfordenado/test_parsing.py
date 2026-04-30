import pdfplumber
import re

pdf_path = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\Inbound-61958574-preparation-instructions (2) (1).pdf"

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()
    
    if tables:
        table = tables[0]
        print("Primeros 10 productos del PDF:\n")
        print("=" * 100)
        
        for i, row in enumerate(table[1:11]):
            if row and len(row) >= 2:
                producto = row[0]
                cantidad = row[1]
                
                print(f"\n--- PRODUCTO {i+1} ---")
                print(f"Texto completo:\n{producto}")
                print(f"\nCantidad: {cantidad}")
                
                lines = producto.split('\n')
                print(f"\nLíneas separadas:")
                for j, line in enumerate(lines):
                    print(f"  {j}: {line}")
                
                print("-" * 100)
