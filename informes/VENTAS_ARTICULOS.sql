-- Informe: Ventas por Artículo (Consolidado)
-- Parámetros: @CodigoArticulo, @DescripcionArticulo, @FechaInicio, @FechaFin, @Local, @Marca

-- DECLARACIÓN DE VARIABLES
DECLARE @CodigoArticulo VARCHAR(50) = {codigo_articulo};
DECLARE @DescripcionArticulo VARCHAR(200) = {descripcion_articulo};
DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @Marca VARCHAR(50) = {marca};

-- CONSULTA
SELECT 
    'del ' + CONVERT(VARCHAR, @FechaInicio, 103) + ' al ' + CONVERT(VARCHAR, @FechaFin, 103) AS PERIODO,
    MARCA,
    CODIGO_ARTICULO,
    TRIM(CASE 
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0 
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION 
    END) AS ARTICULO_LIMPIO,
    LTRIM(RTRIM(REPLACE(LOCAL, 'DRAGONFISH_', ''))) AS LOCAL,
    SUM(CASE 
        WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
        THEN CANTIDAD_VENDIDA * -1 
        ELSE CANTIDAD_VENDIDA 
    END) AS TOTAL_VENDIDO,
    SUM(CASE 
        WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
        THEN MONTO_VENTA_NETO_IVA * -1 
        ELSE MONTO_VENTA_NETO_IVA 
    END) AS MONTO_VENDIDO
FROM VENTAS
WHERE 
    -- Filtro de Fechas
    CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
    
    -- Filtro de Precio
    AND PRECIO_UNIDAD > 10

    -- Filtros Opcionales
    AND (CODIGO_ARTICULO = @CodigoArticulo OR @CodigoArticulo IS NULL)
    AND (
        @DescripcionArticulo IS NULL
        OR TRIM(CASE
            WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
            THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
            ELSE ARTICULO_DESCRIPCION
        END) LIKE '%' + @DescripcionArticulo + '%'
    )
    AND (
        @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
        OR LTRIM(RTRIM(REPLACE(LOCAL, 'DRAGONFISH_', ''))) IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Local, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
    )
    AND (MARCA = @Marca OR @Marca IS NULL)

GROUP BY 
    MARCA,
    CODIGO_ARTICULO, 
    TRIM(CASE 
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0 
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION 
    END),
    LTRIM(RTRIM(REPLACE(LOCAL, 'DRAGONFISH_', '')))
ORDER BY 
    -- 1. Calcula el total global del artículo para posicionar el bloque
    SUM(SUM(CASE 
        WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
        THEN CANTIDAD_VENDIDA * -1 
        ELSE CANTIDAD_VENDIDA 
    END)) OVER(PARTITION BY CODIGO_ARTICULO) DESC,

    -- 2. Agrupa los registros del mismo artículo juntos
    CODIGO_ARTICULO,

    -- 3. Ordena los locales de ese artículo (ej: MUNDOAL antes que DEPOSITO)
    TOTAL_VENDIDO DESC;