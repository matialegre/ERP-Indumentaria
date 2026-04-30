import pdfplumber
import re

pdf_path = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\Inbound-61958574-preparation-instructions (2) (1).pdf"

print("Analizando TODOS los formatos de productos...\n")

with pdfplumber.open(pdf_path) as pdf:
    for page in pdf.pages[:5]:
        tables = page.extract_tables()
        
        for table in tables:
            if not table or len(table) < 2:
                continue
            
            for row in table[1:]:
                if not row or len(row) < 2:
                    continue
                
                producto_text = row[0] if row[0] else ''
                cantidad = row[1] if len(row) > 1 else ''
                
                if not producto_text.strip():
                    continue
                
                lines = [l.strip() for l in producto_text.split('\n') if l.strip()]
                
                last_line = lines[-1] if lines else ''
                
                if '|' in last_line or re.search(r'\d{2}\s*(?:AR|Ar)', last_line) or re.search(r'\b[XSML]{1,3}\b', last_line):
                    print("=" * 100)
                    print(f"Cantidad: {cantidad}")
                    print(f"Líneas:")
                    for i, line in enumerate(lines):
                        print(f"  [{i}] {line}")
                    print(f"\nÚltima línea (color+talle): {last_line}")
                    
                    if '|' in last_line:
                        parts = last_line.split('|')
                        print(f"  -> Con pipe: color='{parts[0].strip()}', talle='{parts[1].strip() if len(parts)>1 else ''}'")
                    else:
                        print(f"  -> Sin pipe, formato diferente")
                    print()
