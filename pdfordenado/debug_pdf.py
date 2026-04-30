import pdfplumber

pdf_path = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\Inbound-61958574-preparation-instructions (2) (1).pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total páginas: {len(pdf.pages)}\n")
    
    for i, page in enumerate(pdf.pages[:3]):
        print(f"{'='*80}")
        print(f"PÁGINA {i+1}")
        print(f"{'='*80}")
        text = page.extract_text()
        print(text[:2000])
        print("\n")
        
        tables = page.extract_tables()
        if tables:
            print(f"\n--- TABLAS ENCONTRADAS: {len(tables)} ---")
            for j, table in enumerate(tables[:2]):
                print(f"\nTabla {j+1}:")
                for row in table[:10]:
                    print(row)
