import pdfplumber
import re

pdf_path = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\Inbound-61958574-preparation-instructions (2) (1).pdf"

print("Analizando colores en el PDF...\n")
print("=" * 100)

colors_found = set()

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
                lines = producto_text.split('\n')
                
                for line in lines:
                    if '|' in line and ('AR' in line or 'Ar' in line or re.search(r'\b[XSML]{1,3}\b', line)):
                        parts = line.split('|')
                        if len(parts) >= 2:
                            color_part = parts[-2].strip() if len(parts) > 2 else parts[0].strip()
                            
                            color_match = re.search(r'([A-Za-zÁÉÍÓÚáéíóúñÑ\s/\-]+?)\s*(?:\||$)', color_part)
                            if color_match:
                                color = color_match.group(1).strip()
                                if color and not re.match(r'^\d+$', color):
                                    colors_found.add(color)

print("\nColores únicos encontrados en el PDF:\n")
for i, color in enumerate(sorted(colors_found), 1):
    print(f"{i:3d}. {color}")

print(f"\n\nTotal: {len(colors_found)} colores diferentes")

print("\n" + "=" * 100)
print("\nEjemplos específicos mencionados:\n")

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
                
                if 'IJASAFAPIXAAZ46' in producto_text:
                    print("SKU: IJASAFAPIXAAZ46")
                    print(producto_text)
                    print("-" * 100)
                
                if 'NPRTB6EPOB-MCN-48' in producto_text:
                    print("\nSKU: NPRTB6EPOB-MCN-48")
                    print(producto_text)
                    print("-" * 100)
                
                if 'Verde oscuro' in producto_text:
                    print("\nProducto con 'Verde oscuro':")
                    print(producto_text)
                    print("-" * 100)
