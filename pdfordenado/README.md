# Reorganizador de Inventario - Mundo Outdoor

## 📋 Descripción
Programa en Python que reorganiza automáticamente el inventario del PDF por:
1. **MODELO** (ej: Zapatillas Montagne Deiro Outdoor Mujer Grafito)
2. **COLOR** 
3. **TALLES**

## 🚀 Instalación

```bash
pip install -r requirements.txt
```

## 💻 Uso

```bash
python reorganizar_inventario.py
```

## 📦 Archivos Generados

1. **inventario_ordenado.xlsx** - Excel para trabajar con los datos
   - Columnas: MODELO, COLOR, TALLE, SKU, CANTIDAD, DESCRIPCIÓN
   - Ordenado automáticamente

2. **inventario_ordenado.pdf** - PDF formateado para imprimir
   - Organizado por modelo y color
   - Tabla clara con talles, SKU y cantidades

## 📊 Características

- ✅ Extrae datos del PDF automáticamente
- ✅ Identifica SKU, colores y talles
- ✅ Agrupa por modelo, color y talle
- ✅ Genera Excel editable
- ✅ Genera PDF listo para imprimir
- ✅ Formato limpio y profesional

## 🔧 Dependencias

- pdfplumber - Extracción de datos del PDF
- pandas - Manipulación de datos
- openpyxl - Generación de Excel
- reportlab - Generación de PDF
