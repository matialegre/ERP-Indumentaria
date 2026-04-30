import pandas as pd

excel_file = r"c:\Users\Mundo Outdoor\Desktop\pdfordenado\inventario_ordenado.xlsx"

df = pd.read_excel(excel_file)

print("=" * 80)
print("VERIFICACIÓN DE DATOS EXTRAÍDOS")
print("=" * 80)

print(f"\nTotal de registros: {len(df)}")
print(f"Total de unidades: {df['CANTIDAD'].sum()}")

print("\n" + "=" * 80)
print("PRIMEROS 20 REGISTROS:")
print("=" * 80)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', None)
pd.set_option('display.max_colwidth', 60)

print(df.head(20).to_string(index=False))

print("\n" + "=" * 80)
print("RESUMEN POR COLOR:")
print("=" * 80)
color_summary = df.groupby('COLOR').agg({
    'CANTIDAD': 'sum',
    'MODELO': 'count'
}).rename(columns={'CANTIDAD': 'Total Unidades', 'MODELO': 'Cantidad Items'})
print(color_summary.sort_values('Total Unidades', ascending=False))

print("\n" + "=" * 80)
print("TOP 10 MODELOS CON MÁS UNIDADES:")
print("=" * 80)
model_summary = df.groupby('MODELO')['CANTIDAD'].sum().sort_values(ascending=False).head(10)
for modelo, cantidad in model_summary.items():
    print(f"{cantidad:4d} unidades - {modelo[:70]}")

print("\n" + "=" * 80)
print("DISTRIBUCIÓN DE TALLES:")
print("=" * 80)
size_summary = df.groupby('TALLE')['CANTIDAD'].sum().sort_index()
print(size_summary)
