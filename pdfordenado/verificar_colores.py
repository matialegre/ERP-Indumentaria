import pandas as pd

excel_file = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\inventario_ordenado.xlsx"
df = pd.read_excel(excel_file)

print("=" * 100)
print("VERIFICACIÓN DE COLORES ESPECÍFICOS")
print("=" * 100)

print("\n1. SKU: IJASAFAPIXAAZ46 (debería ser 'Acero/Azul' o 'Trekking Acero/Azul')")
result = df[df['SKU'] == 'IJASAFAPIXAAZ46']
if not result.empty:
    print(f"   Modelo: {result.iloc[0]['MODELO']}")
    print(f"   Color:  {result.iloc[0]['COLOR']}")
    print(f"   Talle:  {result.iloc[0]['TALLE']}")
else:
    print("   ❌ No encontrado")

print("\n2. SKU: NPRTB6EPOB-MCN-48 (debería ser 'Microrayado Negro')")
result = df[df['SKU'] == 'NPRTB6EPOB-MCN-48']
if not result.empty:
    print(f"   Modelo: {result.iloc[0]['MODELO']}")
    print(f"   Color:  {result.iloc[0]['COLOR']}")
    print(f"   Talle:  {result.iloc[0]['TALLE']}")
else:
    print("   ❌ No encontrado")

print("\n3. Productos con 'Verde Oscuro'")
result = df[df['COLOR'].str.contains('Verde Oscuro', case=False, na=False)]
if not result.empty:
    print(f"   Encontrados: {len(result)} productos")
    print(f"   Modelo: {result.iloc[0]['MODELO']}")
    print(f"   Color:  {result.iloc[0]['COLOR']}")
else:
    print("   ❌ No encontrado")

print("\n" + "=" * 100)
print("TODOS LOS COLORES EN EL EXCEL:")
print("=" * 100)
colors = df['COLOR'].value_counts().sort_index()
for color, count in colors.items():
    print(f"  {color:30s} - {count:3d} productos")

print("\n" + "=" * 100)
print("MUESTRA DE PRODUCTOS CON COLORES COMPLEJOS:")
print("=" * 100)
pd.set_option('display.max_colwidth', 50)
sample = df[df['COLOR'].str.contains('/', na=False) | 
            df['COLOR'].str.contains('Microrayado', case=False, na=False) |
            df['COLOR'].str.contains('Oscuro', case=False, na=False)]
if not sample.empty:
    print(sample[['MODELO', 'COLOR', 'TALLE', 'SKU']].head(20).to_string(index=False))
else:
    print("No se encontraron colores complejos")
