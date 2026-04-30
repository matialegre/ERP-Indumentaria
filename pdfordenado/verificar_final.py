import pandas as pd

excel_file = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\inventario_ordenado.xlsx"
df = pd.read_excel(excel_file)

print("=" * 100)
print("VERIFICACIÓN FINAL DE CASOS PROBLEMÁTICOS")
print("=" * 100)

print("\n1. Productos con 'Sin Especificar':")
sin_esp = df[df['COLOR'] == 'Sin Especificar']
print(sin_esp[['MODELO', 'COLOR', 'TALLE', 'SKU', 'CANTIDAD']].to_string(index=False))

print("\n" + "=" * 100)
print("\n2. Productos 'Stride' (debería tener color Marrón):")
stride = df[df['MODELO'].str.contains('Stride', case=False, na=False)]
print(stride[['MODELO', 'COLOR', 'TALLE', 'SKU', 'CANTIDAD']].head(10).to_string(index=False))

print("\n" + "=" * 100)
print("\n3. Productos 'New Blaze' (debería tener colores como Coral, Navy):")
blaze = df[df['MODELO'].str.contains('Blaze', case=False, na=False)]
print(blaze[['MODELO', 'COLOR', 'TALLE', 'SKU', 'CANTIDAD']].head(15).to_string(index=False))

print("\n" + "=" * 100)
print("\n4. Buzo Micropolar (debería ser Negro):")
buzo = df[df['MODELO'].str.contains('Buzo|Micropolar', case=False, na=False)]
print(buzo[['MODELO', 'COLOR', 'TALLE', 'SKU', 'CANTIDAD']].to_string(index=False))

print("\n" + "=" * 100)
print("\nRESUMEN FINAL:")
print(f"  Total productos: {len(df)}")
print(f"  Total unidades: {df['CANTIDAD'].sum()}")
print(f"  Modelos únicos: {df['MODELO'].nunique()}")
print(f"  Colores únicos: {df['COLOR'].nunique()}")
print(f"  Productos sin color: {len(sin_esp)}")
